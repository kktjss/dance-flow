package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CheckProjectAccess проверяет, есть ли у пользователя доступ к проекту
func CheckProjectAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
		if projectID == "" || projectID == "undefined" || projectID == "null" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
			c.Abort()
			return
		}

		// Получаем ID пользователя из контекста
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Преобразуем ID проекта в ObjectID
		projectObjID, err := primitive.ObjectIDFromHex(projectID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
			c.Abort()
			return
		}

		// Создаем контекст с таймаутом
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Сначала проверяем, является ли пользователь владельцем проекта (наиболее частый случай)
		var projectCount int64
		projectCount, err = config.ProjectsCollection.CountDocuments(ctx, bson.M{
			"_id": projectObjID,
			"owner": userID,
		})
		
		if err == nil && projectCount > 0 {
			// Пользователь является владельцем проекта, разрешаем доступ
			c.Next()
			return
		}

		// Если не владелец, проверяем, является ли это командным проектом и входит ли пользователь в эту команду
		var project bson.M
		err = config.ProjectsCollection.FindOne(ctx, bson.M{
			"_id": projectObjID,
		}).Decode(&project)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			c.Abort()
			return
		}

		// Если у проекта есть ID команды, проверяем, является ли пользователь членом этой команды
		if teamIDValue, hasTeamID := project["teamId"]; hasTeamID && !teamIDValue.(primitive.ObjectID).IsZero() {
			teamID := teamIDValue.(primitive.ObjectID)
			
			// Проверяем, является ли пользователь членом команды
			teamCount, teamErr := config.TeamsCollection.CountDocuments(ctx, bson.M{
				"_id": teamID,
				"$or": []bson.M{
					{"owner": userID},          // Пользователь является владельцем команды
					{"members.userId": userID}, // Пользователь является членом команды
				},
			})
			
			if teamErr == nil && teamCount > 0 {
				// Пользователь входит в команду, разрешаем доступ
				c.Next()
				return
			}
		}

		// Если мы дошли до этого места, у пользователя нет доступа
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this project"})
		c.Abort()
	}
}

// CheckTeamAccess проверяет, есть ли у пользователя доступ к команде
func CheckTeamAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		teamID := c.Param("id")
		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
			c.Abort()
			return
		}

		// Получаем ID пользователя из контекста
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Преобразуем ID команды в ObjectID
		teamObjID, err := primitive.ObjectIDFromHex(teamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			c.Abort()
			return
		}

		// Создаем контекст с таймаутом
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Проверяем, существует ли команда и есть ли у пользователя доступ
		var result bson.M
		err = config.TeamsCollection.FindOne(ctx, bson.M{
			"_id": teamObjID,
			"$or": []bson.M{
				{"owner": userID},          // Пользователь является владельцем
				{"members.userId": userID}, // Пользователь является участником
			},
		}).Decode(&result)

		if err != nil {
			// Если команда не найдена или у пользователя нет доступа
			c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this team"})
			c.Abort()
			return
		}

		// Доступ к команде разрешен
		c.Next()
	}
} 