package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Регистрирует все маршруты для ключевых кадров
func RegisterKeyframesRoutes(router *gin.RouterGroup, cfg *config.Config) {
	// Эндпоинт для прямого управления ключевыми кадрами 
	direct := router.Group("/direct-keyframes")
	direct.Use(middleware.JWTMiddleware(cfg))
	{
		direct.POST("", createDirectKeyframe)
		direct.GET("/project/:projectId", getProjectKeyframes)
		direct.PUT("/:id", updateKeyframe)
		direct.DELETE("/:id", deleteKeyframe)
	}
}

// Добавляет новый ключевой кадр напрямую
func createDirectKeyframe(c *gin.Context) {
	var input models.KeyframeCreateInput
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

	// Преобразуем ID проекта в ObjectID
	projectObjID, err := primitive.ObjectIDFromHex(input.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Создаем ключевой кадр
	keyframe := models.Keyframe{
		ID:        primitive.NewObjectID(),
		ProjectID: projectObjID,
		Timestamp: input.Timestamp,
		Label:     input.Label,
		PoseData:  input.PoseData,
		ImageData: input.ImageData,
		CreatedBy: userID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Вставляем ключевой кадр в базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.KeyframesCollection.InsertOne(ctx, keyframe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create keyframe"})
		return
	}

	// Обновляем проект, добавляя ссылку на ключевой кадр
	keyframeRef := models.KeyframeRef{
		KeyframeID: keyframe.ID,
		Timestamp:  keyframe.Timestamp,
		Label:      keyframe.Label,
	}

	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{
			"$push": bson.M{"keyframes": keyframeRef},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project with keyframe"})
		return
	}

	c.JSON(http.StatusCreated, keyframe)
}

// Получает все ключевые кадры для проекта
func getProjectKeyframes(c *gin.Context) {
	projectID := c.Param("projectId")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
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

	// Проверяем, существует ли проект и есть ли у пользователя доступ
	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Получаем ключевые кадры для проекта
	cursor, err := config.KeyframesCollection.Find(
		ctx,
		bson.M{"projectId": projectObjID},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get keyframes"})
		return
	}
	defer cursor.Close(ctx)

	var keyframes []models.Keyframe
	if err := cursor.All(ctx, &keyframes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode keyframes"})
		return
	}

	c.JSON(http.StatusOK, keyframes)
}

// Обновляет ключевой кадр
func updateKeyframe(c *gin.Context) {
	keyframeID := c.Param("id")
	if keyframeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyframe ID is required"})
		return
	}

	var input models.KeyframeUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	keyframeObjID, err := primitive.ObjectIDFromHex(keyframeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid keyframe ID format"})
		return
	}

	// Создаем документ обновления
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	// Добавляем опциональные поля, если они предоставлены
	if input.Label != "" {
		update["$set"].(bson.M)["label"] = input.Label
	}
	if input.PoseData != nil {
		update["$set"].(bson.M)["poseData"] = input.PoseData
	}
	if input.ImageData != "" {
		update["$set"].(bson.M)["imageData"] = input.ImageData
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Обновляем ключевой кадр
	result, err := config.KeyframesCollection.UpdateOne(
		ctx,
		bson.M{"_id": keyframeObjID},
		update,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update keyframe"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Получаем обновленный ключевой кадр
	var updatedKeyframe models.Keyframe
	err = config.KeyframesCollection.FindOne(ctx, bson.M{"_id": keyframeObjID}).Decode(&updatedKeyframe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated keyframe"})
		return
	}

	// Обновляем ссылку на ключевой кадр в проекте, если изменилась метка
	if input.Label != "" {
		_, err = config.ProjectsCollection.UpdateOne(
			ctx,
			bson.M{"keyframes.keyframeId": keyframeObjID},
			bson.M{
				"$set": bson.M{
					"keyframes.$.label": input.Label,
					"updatedAt":         time.Now(),
				},
			},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project reference"})
			return
		}
	}

	c.JSON(http.StatusOK, updatedKeyframe)
}

// Удаляет ключевой кадр
func deleteKeyframe(c *gin.Context) {
	keyframeID := c.Param("id")
	if keyframeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyframe ID is required"})
		return
	}

	keyframeObjID, err := primitive.ObjectIDFromHex(keyframeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid keyframe ID format"})
		return
	}

	// Создаем контекст с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Сначала получаем ключевой кадр, чтобы получить ID проекта
	var keyframe models.Keyframe
	err = config.KeyframesCollection.FindOne(ctx, bson.M{"_id": keyframeObjID}).Decode(&keyframe)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Удаляем ключевой кадр
	result, err := config.KeyframesCollection.DeleteOne(ctx, bson.M{"_id": keyframeObjID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete keyframe"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Удаляем ссылку на ключевой кадр из проекта
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": keyframe.ProjectID},
		bson.M{
			"$pull": bson.M{"keyframes": bson.M{"keyframeId": keyframeObjID}},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Keyframe deleted successfully"})
} 