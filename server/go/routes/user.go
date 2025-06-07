package routes

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// Регистрирует все маршруты пользователей
func RegisterUserRoutes(router *gin.RouterGroup, cfg *config.Config) {
	users := router.Group("/users")
	users.Use(middleware.JWTMiddleware(cfg))
	{
		users.GET("", getUsers)
		users.GET("/:id", getUserByID)
		users.PUT("/me", updateCurrentUser)
		users.GET("/me", getCurrentUser)
		users.DELETE("/me", deleteCurrentUser)
		
		// Добавляет тестовый эндпоинт
		users.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "User routes are working"})
		})
	}
}

// getUsers ищет пользователей с опциональными фильтрами
func getUsers(c *gin.Context) {
	// Получаем параметры запроса
	search := c.Query("search")
	teamID := c.Query("teamId")
	
	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Создаем фильтр
	filter := bson.M{}
	
	// Добавляем фильтр поиска, если он указан
	if search != "" {
		filter["$or"] = []bson.M{
			{"username": bson.M{"$regex": search, "$options": "i"}},
			{"name": bson.M{"$regex": search, "$options": "i"}},
			{"email": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	
	// Добавляем фильтр по команде, если он указан
	if teamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(teamID)
		if err == nil {
			filter["teams"] = teamObjID
		}
	}
	
	// Настройки поиска
	findOptions := options.Find().
		SetSort(bson.M{"username": 1}).
		SetLimit(50) // Ограничиваем до 50 результатов для безопасности
	
	// Выполняем запрос
	cursor, err := config.UsersCollection.Find(ctx, filter, findOptions)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get users: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}
	defer cursor.Close(ctx)

	// Декодируем пользователей
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		config.LogError("USERS", fmt.Errorf("failed to decode users: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode users"})
		return
	}
	
	// Преобразуем в безопасные объекты ответа
	var userResponses []models.UserResponse
	for _, user := range users {
		userResponses = append(userResponses, user.ToResponse())
	}

	c.JSON(http.StatusOK, userResponses)
}

// getUserByID возвращает конкретного пользователя по ID
func getUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Преобразуем ID пользователя в ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Ищем пользователя по ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Преобразуем в безопасный объект ответа
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// getCurrentUser возвращает текущего аутентифицированного пользователя
func getCurrentUser(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Ищем пользователя по ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Преобразуем в безопасный объект ответа
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// updateCurrentUser обновляет текущего аутентифицированного пользователя
func updateCurrentUser(c *gin.Context) {
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
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

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Ищем пользователя по ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Обновляем поля
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}

	if input.Email != "" {
		// Проверяем, не используется ли уже этот email
		var existingUser models.User
		err = config.UsersCollection.FindOne(ctx, bson.M{
			"_id":   bson.M{"$ne": userID},
			"email": input.Email,
		}).Decode(&existingUser)

		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
			return
		}

		update["$set"].(bson.M)["email"] = input.Email
	}

	if input.Password != "" {
		// Хешируем пароль с помощью bcrypt напрямую
		hashedBytes, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			config.LogError("USERS", fmt.Errorf("failed to hash password: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		update["$set"].(bson.M)["password"] = string(hashedBytes)
	}

	// Обновляем пользователя
	_, err = config.UsersCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to update user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	// Получаем обновленного пользователя
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get updated user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated user"})
		return
	}

	// Преобразуем в безопасный объект ответа
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// deleteCurrentUser удаляет текущего аутентифицированного пользователя и все связанные данные
func deleteCurrentUser(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Удаляем пользователя из всех команд, где он является участником
	_, err = config.TeamsCollection.UpdateMany(
		ctx,
		bson.M{"members.userId": userID},
		bson.M{"$pull": bson.M{"members": bson.M{"userId": userID}}},
	)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to remove user from teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 2. Удаляем все модели пользователя
	// Сначала получаем все модели пользователя для удаления файлов
	cursor, err := config.GetCollection("models").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to find user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	defer cursor.Close(ctx)

	var models []models.Model
	if err := cursor.All(ctx, &models); err != nil {
		config.LogError("USERS", fmt.Errorf("failed to decode user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// Удаляем файлы моделей
	for _, model := range models {
		filePath := filepath.Join("uploads/models", model.Filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			config.LogError("USERS", fmt.Errorf("failed to delete model file %s: %w", filePath, err))
			// Продолжаем удаление даже если удаление файла не удалось
		}
	}

	// Удаляем записи моделей
	_, err = config.GetCollection("models").DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 3. Удаляем все проекты пользователя
	_, err = config.ProjectsCollection.DeleteMany(ctx, bson.M{"owner": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 4. Удаляем записи истории пользователя
	_, err = config.GetCollection("history").DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's history: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 5. Удаляем команды, где пользователь является владельцем
	_, err = config.TeamsCollection.DeleteMany(ctx, bson.M{"owner": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 6. Наконец, удаляем самого пользователя
	_, err = config.UsersCollection.DeleteOne(ctx, bson.M{"_id": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
} 