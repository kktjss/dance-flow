package middleware

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JWTMiddleware проверяет JWT токен и устанавливает ID пользователя в контекст
func JWTMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Получаем заголовок авторизации
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Проверяем, имеет ли заголовок формат "Bearer {token}"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		// Извлекаем токен
		tokenString := parts[1]
		claims := jwt.MapClaims{}

		// Разбираем и проверяем токен
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Проверяем метод подписи
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		if !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Проверяем срок действия токена
		exp, ok := claims["exp"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		if int64(exp) < time.Now().Unix() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token expired"})
			c.Abort()
			return
		}

		// Извлекаем ID пользователя
		userID, ok := claims["id"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Устанавливаем ID пользователя в контекст для дальнейшего использования
		c.Set("userID", userID)
		c.Next()
	}
}

// AuthMiddleware - псевдоним для JWTMiddleware для обратной совместимости
var AuthMiddleware = JWTMiddleware

// GetUserID извлекает ID пользователя из контекста
func GetUserID(c *gin.Context) (primitive.ObjectID, error) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		return primitive.ObjectID{}, errors.New("user ID not found in context")
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		return primitive.ObjectID{}, errors.New("invalid user ID format")
	}

	return userID, nil
}

// GenerateToken генерирует JWT токен для пользователя
func GenerateToken(userID primitive.ObjectID, cfg *config.Config) (string, error) {
	// Разбираем время истечения срока действия
	expDuration, err := time.ParseDuration(cfg.JWTExpiration)
	if err != nil {
		log.Printf("Invalid JWT expiration duration: %v, using default 24h", err)
		expDuration = 24 * time.Hour // По умолчанию 24 часа
	}

	// Проверяем, установлен ли JWT секрет
	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT secret is empty!")
	}

	// Создаем токен с ID пользователя в claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       userID.Hex(),
		"exp":      time.Now().Add(expDuration).Unix(),
	})

	// Логируем claims токена для отладки
	log.Printf("Creating token for user ID: %s with expiration: %v", 
		userID.Hex(), time.Now().Add(expDuration))

	// Подписываем токен секретом
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		log.Printf("Token signing error: %v", err)
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return tokenString, nil
}

// CheckProjectIsPrivate проверяет, является ли проект приватным и проверяет доступ пользователя
func CheckProjectIsPrivate() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
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

		// Получаем проект
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var project models.Project
		err = config.GetCollection("projects").FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			c.Abort()
			return
		}

		// Проверяем, является ли проект публичным или у пользователя есть доступ
		if !project.IsPrivate {
			// Публичный проект, разрешаем доступ
			c.Next()
			return
		}

		// Приватный проект, проверяем, является ли пользователь владельцем или членом команды
		if project.Owner == userID {
			// Пользователь является владельцем
			c.Next()
			return
		}

		// Проверяем, является ли пользователь членом команды проекта
		if !project.TeamID.IsZero() {
			var team models.Team
			err = config.GetCollection("teams").FindOne(ctx, bson.M{
				"_id": project.TeamID,
				"members": bson.M{
					"$elemMatch": bson.M{
						"userId": userID,
					},
				},
			}).Decode(&team)

			if err == nil {
				// Пользователь является членом команды
				c.Next()
				return
			}
		}

		// У пользователя нет доступа
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this project"})
		c.Abort()
	}
} 