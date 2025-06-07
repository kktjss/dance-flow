package routes

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Регистрирует тестовые маршруты
func RegisterTestRoutes(router *gin.RouterGroup, cfg *config.Config) {
	testGroup := router.Group("/test")
	testGroup.Use(middleware.AuthMiddleware(cfg))

	testGroup.POST("/test-save-keyframes", testSaveKeyframes)
	
	// Добавляем прокси-маршрут для process-frame
	router.POST("/process-frame", proxyProcessFrame)
}

// proxyProcessFrame перенаправляет запросы на Python сервер
func proxyProcessFrame(c *gin.Context) {
	log.Println("[PROXY] Forwarding /api/process-frame request to Python server")
	
	// Создаем целевой URL
	target, err := url.Parse("http://127.0.0.1:8000/process-frame")
	if err != nil {
		log.Printf("[PROXY] Error parsing target URL: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Proxy error"})
		return
	}
	
	// Копируем параметры запроса
	query := target.Query()
	for k, v := range c.Request.URL.Query() {
		for _, vv := range v {
			query.Add(k, vv)
		}
	}
	target.RawQuery = query.Encode()
	
	// Создаем HTTP клиент
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	// Создаем новый запрос
	req, err := http.NewRequest(c.Request.Method, target.String(), c.Request.Body)
	if err != nil {
		log.Printf("[PROXY] Error creating request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Proxy error"})
		return
	}
	
	// Копируем заголовки
	for k, v := range c.Request.Header {
		if k != "Content-Length" { // Пропускаем Content-Length, так как он будет установлен автоматически
			for _, vv := range v {
				req.Header.Add(k, vv)
			}
		}
	}
	
	// Отправляем запрос
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[PROXY] Error forwarding request: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Proxy error", "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	
	// Копируем заголовки ответа
	for k, v := range resp.Header {
		for _, vv := range v {
			c.Header(k, vv)
		}
	}
	
	// Устанавливаем код состояния
	c.Status(resp.StatusCode)
	
	// Копируем тело ответа
	_, err = io.Copy(c.Writer, resp.Body)
	if err != nil {
		log.Printf("[PROXY] Error copying response: %v", err)
	}
}

// testSaveKeyframes обрабатывает прямые тестовые операции для сохранения ключевых кадров
func testSaveKeyframes(c *gin.Context) {
	log.Println("[TEST ROUTE] Test-save-keyframes endpoint called")

	// Разбираем запрос
	var requestBody struct {
		ProjectID string        `json:"projectId"`
		ElementID string        `json:"elementId"`
		Keyframes []interface{} `json:"keyframes"`
	}

	if err := c.ShouldBindJSON(&requestBody); err != nil {
		log.Printf("[TEST ROUTE] Error binding request: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid data format",
			"error":   err.Error(),
		})
		return
	}

	// Проверяем обязательные поля
	if requestBody.ProjectID == "" || requestBody.ElementID == "" || requestBody.Keyframes == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Missing required data",
			"received": gin.H{
				"hasProjectId":     requestBody.ProjectID != "",
				"hasElementId":     requestBody.ElementID != "",
				"hasKeyframes":     requestBody.Keyframes != nil,
				"keyframesIsArray": requestBody.Keyframes != nil,
			},
		})
		return
	}

	log.Printf("[TEST ROUTE] Received request to save %d keyframes for element %s in project %s",
		len(requestBody.Keyframes), requestBody.ElementID, requestBody.ProjectID)

	// Создаем структуру данных для ключевых кадров
	keyframesData := map[string]interface{}{
		requestBody.ElementID: requestBody.Keyframes,
	}

	// Конвертируем в JSON строку
	keyframesJSON, err := json.Marshal(keyframesData)
	if err != nil {
		log.Printf("[TEST ROUTE] Error serializing keyframes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error processing keyframes data"})
		return
	}
	log.Printf("[TEST ROUTE] Created keyframesJson with length %d", len(keyframesJSON))

	// Конвертируем ID проекта в ObjectID
	projectObjID, err := primitive.ObjectIDFromHex(requestBody.ProjectID)
	if err != nil {
		log.Printf("[TEST ROUTE] Invalid project ID: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid project ID format"})
		return
	}

	// ПРЯМОЕ ОБНОВЛЕНИЕ БАЗЫ ДАННЫХ с использованием низкоуровневых операций MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	projectsCollection := config.GetCollection("projects")
	updateResult, err := projectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$set": bson.M{"keyframesJson": string(keyframesJSON)}},
	)
	if err != nil {
		log.Printf("[TEST ROUTE] Database operation error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Database error", "error": err.Error()})
		return
	}

	log.Printf("[TEST ROUTE] Direct MongoDB update result: %+v", updateResult)

	if updateResult.MatchedCount == 0 {
		log.Printf("[TEST ROUTE] Project not found")
		c.JSON(http.StatusNotFound, gin.H{"message": "Project not found"})
		return
	}

	if updateResult.ModifiedCount == 0 {
		log.Printf("[TEST ROUTE] Document not modified")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Document not modified"})
		return
	}

	// Проверяем обновление
	var verifyResult struct {
		KeyframesJSON string `bson:"keyframesJson"`
	}
	err = projectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&verifyResult)
	if err != nil {
		log.Printf("[TEST ROUTE] Verification query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Verification failed"})
		return
	}

	if verifyResult.KeyframesJSON == "" {
		log.Printf("[TEST ROUTE] Verification failed - keyframesJson is empty")
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Verification failed"})
		return
	}

	log.Printf("[TEST ROUTE] Success! Updated keyframesJson length: %d", len(verifyResult.KeyframesJSON))

	c.JSON(http.StatusOK, gin.H{
		"success":            true,
		"message":            "Keyframes updated successfully",
		"keyframesJsonLength": len(verifyResult.KeyframesJSON),
	})
} 