package routes

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Регистрирует маршруты, связанные с историей
func RegisterHistoryRoutes(router *gin.RouterGroup, cfg *config.Config) {
	historyGroup := router.Group("/history")
	historyGroup.Use(middleware.AuthMiddleware(cfg))

	historyGroup.GET("", getHistory)
	historyGroup.POST("", createHistoryEntry)
}

// Получает записи истории пользователя
func getHistory(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		log.Printf("[HISTORY] Error: userID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	
	userObjID, err := primitive.ObjectIDFromHex(userID.(string))
	if err != nil {
		log.Printf("[HISTORY] Error converting userID to ObjectID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid user ID"})
		return
	}

	// Настраиваем запрос для получения истории пользователя
	collection := config.GetCollection("histories")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Создаем параметры для сортировки и ограничения
	findOptions := options.Find()
	findOptions.SetSort(bson.M{"timestamp": -1})
	findOptions.SetLimit(50)

	// Находим все записи истории для этого пользователя
	cursor, err := collection.Find(ctx, bson.M{"userId": userObjID}, findOptions)
	if err != nil {
		log.Printf("[HISTORY] Error fetching history: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error fetching history"})
		return
	}
	defer cursor.Close(ctx)

	// Декодируем результаты
	var historyEntries []models.History
	if err := cursor.All(ctx, &historyEntries); err != nil {
		log.Printf("[HISTORY] Error decoding history entries: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error processing history data"})
		return
	}

	// Заполняем заголовки проектов (аналогично populate в Mongoose)
	populatedEntries, err := populateProjectTitles(ctx, historyEntries)
	if err != nil {
		log.Printf("[HISTORY] Error populating project titles: %v", err)
		// Продолжаем с незаполненными записями
		c.JSON(http.StatusOK, historyEntries)
		return
	}

	c.JSON(http.StatusOK, populatedEntries)
}

// Создает новую запись в истории
func createHistoryEntry(c *gin.Context) {
	var requestBody struct {
		ProjectID   string `json:"projectId"`
		Action      string `json:"action"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&requestBody); err != nil {
		log.Printf("[HISTORY] Error binding request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request format"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists || userID == nil {
		log.Printf("[HISTORY] Error: userID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}
	
	userObjID, err := primitive.ObjectIDFromHex(userID.(string))
	if err != nil {
		log.Printf("[HISTORY] Error converting userID to ObjectID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid user ID"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(requestBody.ProjectID)
	if err != nil {
		log.Printf("[HISTORY] Error converting projectID to ObjectID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid project ID"})
		return
	}

	// Создаем запись в истории
	entry := models.CreateHistory(
		userObjID,
		projectObjID,
		requestBody.Action,
		requestBody.Description,
	)

	// Сохраняем в базу данных
	collection := config.GetCollection("histories")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := collection.InsertOne(ctx, entry)
	if err != nil {
		log.Printf("[HISTORY] Error creating history entry: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error creating history entry"})
		return
	}

	// Устанавливаем ID из результата вставки
	entry.ID = result.InsertedID.(primitive.ObjectID)

	c.JSON(http.StatusCreated, entry)
}

// Вспомогательная функция для заполнения заголовков проектов для записей истории
func populateProjectTitles(ctx context.Context, entries []models.History) ([]map[string]interface{}, error) {
	projectsCollection := config.GetCollection("projects")
	result := make([]map[string]interface{}, len(entries))

	for i, entry := range entries {
		// Преобразуем запись в карту, чтобы можно было добавить заполненные поля
		entryMap := map[string]interface{}{
			"id":          entry.ID,
			"userId":      entry.UserID,
			"projectId":   entry.ProjectID,
			"action":      entry.Action,
			"description": entry.Description,
			"timestamp":   entry.Timestamp,
		}

		// Находим проект, чтобы получить его заголовок
		var project models.Project
		err := projectsCollection.FindOne(ctx, bson.M{"_id": entry.ProjectID}).Decode(&project)
		if err != nil && err != mongo.ErrNoDocuments {
			return nil, err
		}

		// Добавляем заголовок проекта, если найден
		if err != mongo.ErrNoDocuments {
			entryMap["projectId"] = map[string]interface{}{
				"_id":   project.ID,
				"title": project.Title,
			}
		}

		result[i] = entryMap
	}

	return result, nil
} 