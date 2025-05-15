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

// RegisterModelRoutes registers the routes for 3D models
func RegisterModelRoutes(api *gin.RouterGroup, cfg *config.Config) {
	models := api.Group("/models")
	
	// Create models directory if it doesn't exist
	modelsDir := "./uploads/models"
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		config.LogError("MODELS", fmt.Errorf("failed to create models directory: %w", err))
	}
	
	// Public endpoint for accessing model files without authentication
	models.GET("/file/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filePath := filepath.Join(modelsDir, filename)
		
		// Log the request
		fmt.Printf("Accessing model file: %s\n", filePath)
		
		// Check if file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			fmt.Printf("Model file not found: %s\n", filePath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Model file not found"})
			return
		}
		
		// Set appropriate headers for GLB files
		c.Header("Content-Type", "model/gltf-binary")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Serve the file
		c.File(filePath)
	})

	// The following routes require authentication
	authenticated := models.Group("")
	authenticated.Use(middleware.JWTMiddleware(cfg))

	// Get all models for the current user
	authenticated.GET("", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Convert userID to ObjectID
		objectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Get models from database
		collection := config.GetCollection("models")
		cursor, err := collection.Find(c, bson.M{"userId": objectID})
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error finding models: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve models"})
			return
		}
		defer cursor.Close(c)

		// Decode models
		var modelsList []Model
		if err := cursor.All(c, &modelsList); err != nil {
			config.LogError("MODELS", fmt.Errorf("error decoding models: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode models"})
			return
		}

		// Add URL to each model
		for i := range modelsList {
			modelsList[i].URL = fmt.Sprintf("/uploads/models/%s", modelsList[i].Filename)
		}

		c.JSON(http.StatusOK, modelsList)
	})

	// Upload a new model
	authenticated.POST("/upload", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Convert userID to ObjectID
		objectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Get the file from the request
		file, err := c.FormFile("model")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
			return
		}

		// Validate file type
		ext := filepath.Ext(file.Filename)
		if ext != ".glb" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Only .glb files are allowed"})
			return
		}

		// Generate unique filename
		uniqueID := uuid.New().String()
		filename := uniqueID + ext
		filePath := filepath.Join(modelsDir, filename)

		// Save the file
		if err := c.SaveUploadedFile(file, filePath); err != nil {
			config.LogError("MODELS", fmt.Errorf("error saving file: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
			return
		}

		// Get model name from form
		modelName := c.PostForm("name")
		if modelName == "" {
			// Use original filename without extension as default name
			modelName = filepath.Base(file.Filename)
			modelName = modelName[:len(modelName)-len(ext)]
		}

		// Create model record
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

		// Save to database
		collection := config.GetCollection("models")
		_, err = collection.InsertOne(c, model)
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error inserting model: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save model to database"})
			return
		}

		c.JSON(http.StatusCreated, model)
	})

	// Get a specific model
	authenticated.GET("/:id", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Convert userID to ObjectID
		userObjectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Get model ID from URL
		modelID := c.Param("id")
		modelObjectID, err := primitive.ObjectIDFromHex(modelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid model ID format"})
			return
		}

		// Get model from database
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

		// Check if user owns this model
		if model.UserID != userObjectID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to access this model"})
			return
		}

		// Add URL to model
		model.URL = fmt.Sprintf("/uploads/models/%s", model.Filename)

		c.JSON(http.StatusOK, model)
	})

	// Delete a model
	authenticated.DELETE("/:id", func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
			return
		}

		// Convert userID to ObjectID
		userObjectID, err := primitive.ObjectIDFromHex(userID.(string))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
			return
		}

		// Get model ID from URL
		modelID := c.Param("id")
		modelObjectID, err := primitive.ObjectIDFromHex(modelID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid model ID format"})
			return
		}

		// Get model from database
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

		// Check if user owns this model
		if model.UserID != userObjectID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized to delete this model"})
			return
		}

		// Delete file from disk
		filePath := filepath.Join(modelsDir, model.Filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			config.LogError("MODELS", fmt.Errorf("error deleting file: %w", err))
			// Continue with deletion from database even if file deletion fails
		}

		// Delete from database
		_, err = collection.DeleteOne(c, bson.M{"_id": modelObjectID})
		if err != nil {
			config.LogError("MODELS", fmt.Errorf("error deleting model from database: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete model from database"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Model deleted successfully"})
	})
} 