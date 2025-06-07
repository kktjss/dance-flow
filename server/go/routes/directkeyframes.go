package routes

import (
	"context"
	"encoding/json"
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
)

// Регистрирует маршрут прямого обновления ключевых кадров
func RegisterDirectKeyframesRoutes(router *gin.RouterGroup, cfg *config.Config) {
	directKFGroup := router.Group("/direct-keyframes")
	directKFGroup.Use(middleware.AuthMiddleware(cfg))

	// Маршрут для прямого обновления ключевых кадров
	directKFGroup.POST("/:id", updateDirectKeyframes)
}

// Обрабатывает прямые обновления ключевых кадров проекта
func updateDirectKeyframes(c *gin.Context) {
	projectID := c.Param("id")
	log.Printf("[DIRECT KF] Processing direct keyframe update for project ID: %s", projectID)

	// Разбираем тело запроса
	var requestBody struct {
		ElementID string        `json:"elementId"`
		Keyframes []interface{} `json:"keyframes"`
	}

	if err := c.ShouldBindJSON(&requestBody); err != nil {
		log.Printf("[DIRECT KF] Error binding request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid data format",
			"error":   err.Error(),
		})
		return
	}

	// Проверяем обязательные поля
	if requestBody.ElementID == "" || requestBody.Keyframes == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid data. Required: elementId and keyframes array",
			"received": gin.H{
				"hasElementId":     requestBody.ElementID != "",
				"hasKeyframes":     requestBody.Keyframes != nil,
				"keyframesIsArray": requestBody.Keyframes != nil,
			},
		})
		return
	}

	log.Printf("[DIRECT KF] Received %d keyframes for element %s", len(requestBody.Keyframes), requestBody.ElementID)

	// Преобразуем ID проекта в ObjectID
	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		log.Printf("[DIRECT KF] Invalid project ID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid project ID"})
		return
	}

	// Сначала получаем текущий проект для проверки существующих keyframesJson
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	projectsCollection := config.GetCollection("projects")
	var project models.Project
	err = projectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Printf("[DIRECT KF] Project with ID %s not found", projectID)
			c.JSON(http.StatusNotFound, gin.H{"message": "Project not found"})
		} else {
			log.Printf("[DIRECT KF] Error finding project: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error finding project", "error": err.Error()})
		}
		return
	}

	// Разбираем существующие ключевые кадры или создаем новый объект
	keyframesData := make(map[string]interface{})
	if project.KeyframesJSON != "" && project.KeyframesJSON != "{}" {
		err = json.Unmarshal([]byte(project.KeyframesJSON), &keyframesData)
		if err != nil {
			log.Printf("[DIRECT KF] Error parsing existing keyframesJson: %v", err)
			// Продолжаем с пустым объектом
		} else {
			log.Printf("[DIRECT KF] Parsed existing keyframesJson with %d elements", len(keyframesData))
		}
	} else {
		log.Printf("[DIRECT KF] No existing keyframes, creating new object")
	}

	// Добавляем новые ключевые кадры
	keyframesData[requestBody.ElementID] = requestBody.Keyframes

	// Сериализуем в JSON
	keyframesJSON, err := json.Marshal(keyframesData)
	if err != nil {
		log.Printf("[DIRECT KF] Error serializing keyframes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error processing keyframes data"})
		return
	}

	log.Printf("[DIRECT KF] Updated keyframesJson, length: %d", len(keyframesJSON))

	// Обновляем только поле keyframesJson
	updateResult, err := projectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$set": bson.M{"keyframesJson": string(keyframesJSON)}},
	)
	if err != nil {
		log.Printf("[DIRECT KF] Database error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Database error while updating keyframes",
			"error":   err.Error(),
		})
		return
	}

	log.Printf("[DIRECT KF] Update result: %+v", updateResult)

	if updateResult.ModifiedCount == 0 {
		log.Printf("[DIRECT KF] Document not modified!")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message":      "Failed to update document",
			"updateResult": updateResult,
		})
		return
	}

	// Проверяем, что обновление сработало
	var verifyProject models.Project
	err = projectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&verifyProject)
	if err != nil {
		log.Printf("[DIRECT KF] Verification failed - couldn't retrieve updated project: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Verification failed - couldn't retrieve updated project",
			"error":   err.Error(),
		})
		return
	}

	if verifyProject.KeyframesJSON == "" || verifyProject.KeyframesJSON == "{}" {
		log.Printf("[DIRECT KF] Verification failed! keyframesJson is empty after update")
		c.JSON(http.StatusInternalServerError, gin.H{
			"message":      "Verification failed - keyframesJson is empty after update",
			"beforeLength": len(keyframesJSON),
			"afterLength":  len(verifyProject.KeyframesJSON),
		})
		return
	}

	// Проверяем количество ключевых кадров
	verifyCount := 0
	verifiedData := make(map[string]interface{})
	if err := json.Unmarshal([]byte(verifyProject.KeyframesJSON), &verifiedData); err == nil {
		for _, frames := range verifiedData {
			if frames, ok := frames.([]interface{}); ok {
				verifyCount += len(frames)
			}
		}
		log.Printf("[DIRECT KF] Verification successful. Found %d keyframes in database", verifyCount)
	} else {
		log.Printf("[DIRECT KF] Failed to parse verified keyframesJson: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Keyframes directly updated in database",
		"updated": gin.H{
			"elementId":     requestBody.ElementID,
			"keyframeCount": len(requestBody.Keyframes),
		},
		"verification": gin.H{
			"keyframesJsonLength": len(verifyProject.KeyframesJSON),
			"totalKeyframes":      verifyCount,
		},
	})
} 