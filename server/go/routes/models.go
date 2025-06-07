package routes

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Model представляет 3D модель в системе
type Model struct {
	ID           primitive.ObjectID `json:"id" bson:"_id"`
	Name         string             `json:"name" bson:"name"`
	Filename     string             `json:"filename" bson:"filename"`
	OriginalName string             `json:"originalName" bson:"originalName"`
	Size         int64              `json:"size" bson:"size"`
	UserID       primitive.ObjectID `json:"userId" bson:"userId"`
	CreatedAt    time.Time          `json:"createdAt" bson:"createdAt"`
	URL          string             `json:"url" bson:"-"` // URL не хранится в базе данных
}

// Регистрирует маршруты для 3D моделей
func RegisterModelRoutes(api *gin.RouterGroup, cfg *config.Config) {
	models := api.Group("/models")
	
	// Создаем директорию для моделей, если она не существует
	modelsDir := "./uploads/models"
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		config.LogError("MODELS", fmt.Errorf("failed to create models directory: %w", err))
	}
	
	// Публичный эндпоинт для доступа к файлам моделей без аутентификации
	models.GET("/file/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filePath := filepath.Join(modelsDir, filename)
		
		// Логируем запрос
		fmt.Printf("Accessing model file: %s\n", filePath)
		
		// Проверяем, существует ли файл
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			fmt.Printf("Model file not found: %s\n", filePath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Model file not found"})
			return
		}
		
		// Устанавливаем соответствующие заголовки для GLB файлов
		c.Header("Content-Type", "model/gltf-binary")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Отдаем файл
		c.File(filePath)
	})

	// Следующие маршруты требуют аутентификации
	authenticated := models.Group("")
	authenticated.Use(middleware.JWTMiddleware(cfg))

	// Получаем все модели для текущего пользователя
	authenticated.GET("", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Преобразуем userID в ObjectID
		objectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Получаем модели из базы данных
		collection := config.GetCollection("models")
		cursor, err := collection.Find(c, bson.M{"userId": objectID})
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error finding models: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve models"})
			return
		}
		defer cursor.Close(c)

		// Декодируем модели
		var modelsList []Model
		if err := cursor.All(c, &modelsList); err != nil {
			config.LogError("MODELS", fmt.Errorf("error decoding models: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode models"})
			return
		}

		// Добавляем URL к каждой модели
		for i := range modelsList {
			modelsList[i].URL = fmt.Sprintf("/uploads/models/%s", modelsList[i].Filename)
		}

		c.JSON(http.StatusOK, modelsList)
	})

	// Загружаем новую модель
	authenticated.POST("/upload", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Преобразуем userID в ObjectID
		objectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Получаем файл из запроса
		file, err := c.FormFile("model")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}

		// Проверяем тип файла
		ext := filepath.Ext(file.Filename)
		if ext != ".glb" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only .glb files are allowed"})
			return
		}

		// Генерируем уникальное имя файла
		uniqueID := uuid.New().String()
		filename := uniqueID + ext
		filePath := filepath.Join(modelsDir, filename)

		// Сохраняем файл
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			config.LogError("MODELS", fmt.Errorf("error saving file: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}

		// Получаем имя модели из формы
		modelName := c.PostForm("name")
		if modelName == "" {
			// Используем оригинальное имя файла без расширения как имя по умолчанию
			modelName = filepath.Base(file.Filename)
			modelName = modelName[:len(modelName)-len(ext)]
		}

		// Создаем запись модели
		model := Model{
			ID:           primitive.NewObjectID(),
			Name:         modelName,
			Filename:     filename,
			OriginalName: file.Filename,
			Size:         file.Size,
			UserID:       objectID,
			CreatedAt:    time.Now(),
			URL:          fmt.Sprintf("/uploads/models/%s", filename),
		}

		// Сохраняем в базу данных
		collection := config.GetCollection("models")
		_, err = collection.InsertOne(c, model)
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error inserting model: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save model to database"})
			return
		}

		c.JSON(http.StatusCreated, model)
	})

	// Получаем конкретную модель
	authenticated.GET("/:id", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Преобразуем userID в ObjectID
		userObjectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Получаем ID модели из URL
		modelID := c.Param("id")
		modelObjectID, err := primitive.ObjectIDFromHex(modelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid model ID format"})
			return
		}

		// Получаем модель из базы данных
		collection := config.GetCollection("models")
		var model Model
		err = collection.FindOne(c, bson.M{"_id": modelObjectID}).Decode(&model)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Model not found"})
				return
			}
			config.LogError("MODELS", fmt.Errorf("error finding model: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve model"})
			return
		}

		// Проверяем, владеет ли пользователь этой моделью
		if model.UserID != userObjectID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to access this model"})
			return
		}

		// Добавляем URL к модели
		model.URL = fmt.Sprintf("/uploads/models/%s", model.Filename)

		c.JSON(http.StatusOK, model)
	})

	// Удаляем модель
	authenticated.DELETE("/:id", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Преобразуем userID в ObjectID
		userObjectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Получаем ID модели из URL
		modelID := c.Param("id")
		modelObjectID, err := primitive.ObjectIDFromHex(modelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid model ID format"})
			return
		}

		// Получаем модель из базы данных
		collection := config.GetCollection("models")
		var model Model
		err = collection.FindOne(c, bson.M{"_id": modelObjectID}).Decode(&model)
		if err != nil {
			if err == mongo.ErrNoDocuments {
				c.JSON(http.StatusNotFound, gin.H{"error": "Model not found"})
				return
			}
			config.LogError("MODELS", fmt.Errorf("error finding model: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve model"})
			return
		}

		// Проверяем, владеет ли пользователь этой моделью
		if model.UserID != userObjectID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to delete this model"})
			return
		}

		// Удаляем файл с диска
		filePath := filepath.Join(modelsDir, model.Filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			config.LogError("MODELS", fmt.Errorf("error deleting file: %w", err))
			// Продолжаем удаление из базы данных, даже если удаление файла не удалось
		}

		// Удаляем из базы данных
		_, err = collection.DeleteOne(c, bson.M{"_id": modelObjectID})
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error deleting model from database: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete model from database"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Model deleted successfully"})
	})
} 