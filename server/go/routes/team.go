package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Регистрирует все маршруты команд
func RegisterTeamRoutes(router *gin.RouterGroup, cfg *config.Config) {
	teams := router.Group("/teams")
	teams.Use(middleware.JWTMiddleware(cfg))
	{
		teams.GET("", getTeams)
		teams.POST("", createTeam)
		teams.GET("/:id", middleware.CheckTeamAccess(), getTeam)
		teams.PUT("/:id", middleware.CheckTeamAccess(), updateTeam)
		teams.DELETE("/:id", middleware.CheckTeamAccess(), deleteTeam)
		
		// Управление участниками команды
		teams.GET("/:id/members", middleware.CheckTeamAccess(), getTeamMembers)
		teams.POST("/:id/members", middleware.CheckTeamAccess(), addTeamMember)
		teams.DELETE("/:id/members/:userId", middleware.CheckTeamAccess(), removeTeamMember)
		
		// Управление проектами команды
		teams.GET("/:id/projects", middleware.CheckTeamAccess(), getTeamProjects)
		teams.POST("/:id/projects", middleware.CheckTeamAccess(), addProjectToTeam)
		teams.DELETE("/:id/projects/:projectId", middleware.CheckTeamAccess(), removeProjectFromTeam)
		teams.GET("/:id/projects/:projectId/viewer", middleware.CheckTeamAccess(), getTeamProjectViewer)
		
		// Добавляем тестовый эндпоинт
		teams.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Team routes are working"})
		})
	}
}

// Возвращает все команды, доступные аутентифицированному пользователю
func getTeams(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Фильтр запроса: команды, где пользователь является владельцем ИЛИ участником
	filter := bson.M{
		"$or": []bson.M{
			{"owner": userID},           // Пользователь является владельцем команды
			{"members.userId": userID},  // Пользователь является участником команды
		},
	}

	// Получаем все подходящие команды
	findOptions := options.Find().SetSort(bson.M{"name": 1})
	cursor, err := config.TeamsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get teams"})
		return
	}
	defer cursor.Close(ctx)

	// Декодируем команды
	var teams []models.Team
	if err := cursor.All(ctx, &teams); err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to decode teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode teams"})
		return
	}

	c.JSON(http.StatusOK, teams)
}

// Возвращает одну команду по ID, если у пользователя есть доступ
func getTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Находим команду по ID, проверяя доступ пользователя
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},           // Пользователь является владельцем
			{"members.userId": userID},  // Пользователь является участником
		},
	}).Decode(&team)

	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found or access denied"})
		return
	}

	// Заполняем проекты полными объектами проектов
	if len(team.Projects) > 0 {
		var projectIDs []primitive.ObjectID
		for _, projectIDStr := range team.Projects {
			projectID, err := primitive.ObjectIDFromHex(projectIDStr)
			if err != nil {
				continue // Пропускаем неверные ID
			}
			projectIDs = append(projectIDs, projectID)
		}

		if len(projectIDs) > 0 {
			// Находим все проекты для этой команды
			cursor, err := config.ProjectsCollection.Find(ctx, bson.M{
				"_id": bson.M{"$in": projectIDs},
			})
			
			if err == nil {
				defer cursor.Close(ctx)
				
				// Создаем структуру ответа с проектами как полными объектами
				type TeamResponse struct {
					models.Team
					ProjectObjects []models.Project `json:"projectObjects"`
				}
				
				var projects []models.Project
				if err := cursor.All(ctx, &projects); err == nil {
					response := TeamResponse{
						Team:          team,
						ProjectObjects: projects,
					}
					c.JSON(http.StatusOK, response)
					return
				}
			}
		}
	}

	// Если мы не смогли заполнить проекты или проектов нет, возвращаем команду как есть
	c.JSON(http.StatusOK, team)
}

// Создает новую команду
func createTeam(c *gin.Context) {
	var input models.TeamCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Создаем команду
	team := models.Team{
		ID:          primitive.NewObjectID(),
		Name:        input.Name,
		Description: input.Description,
		Owner:       userID,
		Members:     []models.Member{},
		Projects:    []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Вставляем команду в базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.TeamsCollection.InsertOne(ctx, team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to create team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create team"})
		return
	}

	// Добавляем команду в список команд пользователя
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$addToSet": bson.M{"teams": team.ID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Логируем ошибку, но продолжаем - мы все еще создали команду
	}

	c.JSON(http.StatusCreated, team)
}

// Обновляет команду, если пользователь является владельцем
func updateTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input models.TeamUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, является ли пользователь владельцем команды
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"owner": userID,
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner can update team"})
		return
	}

	// Обновляем команду
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}
	if input.Description != "" {
		update["$set"].(bson.M)["description"] = input.Description
	}

	_, err = config.TeamsCollection.UpdateOne(ctx, bson.M{"_id": teamObjID}, update)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team"})
		return
	}

	// Возвращаем обновленную команду
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// Удаляет команду, если пользователь является владельцем
func deleteTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, является ли пользователь владельцем команды
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"owner": userID,
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner can delete team"})
		return
	}

	// Удаляем команду из списков команд всех пользователей
	_, err = config.UsersCollection.UpdateMany(
		ctx,
		bson.M{"teams": teamObjID},
		bson.M{"$pull": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update users' teams: %w", err))
		// Логируем ошибку, но продолжаем удаление
	}

	// Удаляем команду
	_, err = config.TeamsCollection.DeleteOne(ctx, bson.M{"_id": teamObjID})
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to delete team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team deleted successfully"})
}

// Возвращает всех участников команды
func getTeamMembers(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Находим команду по ID
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	c.JSON(http.StatusOK, team.Members)
}

// Добавляет пользователя в команду
func addTeamMember(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input struct {
		UserID string `json:"userId" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Проверяем роль
	if input.Role != "editor" && input.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be either 'editor' or 'viewer'"})
		return
	}

	// Получаем ID текущего пользователя из контекста
	currentUserID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, является ли пользователь владельцем команды или редактором
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": currentUserID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": currentUserID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can add members"})
		return
	}
	
	// Проверяем, не является ли пользователь уже участником команды
	if team.Owner == userObjID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already the team owner"})
		return
	}
	
	for _, member := range team.Members {
		if member.UserID == userObjID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User is already a member of the team"})
			return
		}
	}

	// Проверяем, существует ли пользователь, которого нужно добавить
	var userToAdd models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&userToAdd)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Добавляем участника в команду
	member := models.Member{
		UserID: userObjID,
		Role:   input.Role,
		Name:   userToAdd.Name,
		Email:  userToAdd.Email,
	}

	// Обновляем команду, добавляя нового участника
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$addToSet": bson.M{"members": member},
			"$set":      bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to add member to team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member to team"})
		return
	}

	// Добавляем команду в список команд пользователя
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userObjID},
		bson.M{"$addToSet": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Логируем ошибку, но продолжаем - мы все еще добавили участника в команду
	}

	// Возвращаем обновленную команду
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// Удаляет пользователя из команды
func removeTeamMember(c *gin.Context) {
	teamID := c.Param("id")
	userIDToRemove := c.Param("userId")
	if teamID == "" || userIDToRemove == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID and User ID are required"})
		return
	}

	// Получаем текущий ID пользователя из контекста
	currentUserID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	userObjIDToRemove, err := primitive.ObjectIDFromHex(userIDToRemove)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, является ли пользователь владельцем команды или редактором
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": currentUserID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": currentUserID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can remove members"})
		return
	}

	// Нельзя удалить владельца
	if team.Owner == userObjIDToRemove {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove the team owner"})
		return
	}

	// Удаляем участника из команды
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$pull": bson.M{"members": bson.M{"userId": userObjIDToRemove}},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to remove member from team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member from team"})
		return
	}

	// Удаляем команду из списка команд пользователя
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userObjIDToRemove},
		bson.M{"$pull": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Логируем ошибку, но продолжаем - мы все еще удалили участника из команды
	}

	// Возвращаем обновленную команду
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// Возвращает все проекты команды
func getTeamProjects(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Находим проекты команды
	cursor, err := config.ProjectsCollection.Find(ctx, bson.M{"teamId": teamObjID})
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get team projects"})
		return
	}
	defer cursor.Close(ctx)

	// Декодируем проекты
	var projects []models.Project
	if err := cursor.All(ctx, &projects); err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to decode projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// Добавляет проект в команду
func addProjectToTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input struct {
		ProjectID string `json:"projectId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(input.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, есть ли у пользователя доступ к команде
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": userID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can add projects"})
		return
	}

	// Проверяем, существует ли проект и есть ли у пользователя доступ к нему
	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{
		"_id": projectObjID,
		"owner": userID,
	}).Decode(&project)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found or you don't have permission"})
		return
	}

	// Добавляем проект в команду
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$addToSet": bson.M{"projects": input.ProjectID},
			"$set":      bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to add project to team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add project to team"})
		return
	}

	// Обновляем проект, чтобы он принадлежал команде
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$set": bson.M{"teamId": teamObjID, "updatedAt": time.Now()}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update project: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Возвращаем обновленную команду
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// Удаляет проект из команды
func removeProjectFromTeam(c *gin.Context) {
	teamID := c.Param("id")
	projectID := c.Param("projectId")
	if teamID == "" || projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID and Project ID are required"})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, есть ли у пользователя доступ к команде
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": userID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can remove projects"})
		return
	}

	// Удаляем проект из команды
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$pull": bson.M{"projects": projectID},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to remove project from team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove project from team"})
		return
	}

	// Обновляем проект, чтобы он больше не принадлежал команде
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$unset": bson.M{"teamId": ""}, "$set": bson.M{"updatedAt": time.Now()}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update project: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Возвращаем обновленную команду
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// Возвращает просмотрщик для проекта команды
func getTeamProjectViewer(c *gin.Context) {
	teamID := c.Param("id")
	projectID := c.Param("projectId")
	
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	
	// Преобразуем ID команды в ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Проверяем, есть ли у пользователя доступ к команде
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members.userId": userID},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Team not found or you don't have access to it"})
		return
	}
	
	// Проверяем, существует ли проект в списке проектов этой команды
	projectFound := false
	for _, p := range team.Projects {
		if p == projectID {
			projectFound = true
			break
		}
	}
	
	if !projectFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found in the team"})
		return
	}
	
	// Используем bson.M для первоначального получения проекта
	var rawProject bson.M
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&rawProject)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	
	// Преобразуем в структуру Project, но обрабатываем элементы отдельно
	var project models.Project
	
	// Удаляем элементы из сырых данных, чтобы избежать ошибок при анмаршалинге
	elementsRaw, hasElements := rawProject["elements"]
	delete(rawProject, "elements")
	
	// Преобразуем оставшиеся поля в структуру Project
	projectBytes, err := bson.Marshal(rawProject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	if err := bson.Unmarshal(projectBytes, &project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	// Обрабатываем элементы отдельно - сохраняем как raw interface{}
	if hasElements {
		project.Elements = []interface{}{}
		
		// Проверяем, является ли elements массивом
		if elemArray, ok := elementsRaw.(primitive.A); ok {
			for _, elem := range elemArray {
				project.Elements = append(project.Elements, elem)
			}
		} else {
			// Если не массив, добавляем как одиночный элемент
			project.Elements = append(project.Elements, elementsRaw)
		}
	}

	// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
	project.NormalizeElements()
	
	// Возвращаем проект напрямую, как это делает getProject
	c.JSON(http.StatusOK, project)
} 