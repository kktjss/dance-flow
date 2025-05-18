package unit

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
	
	// Импортируем нужные пакеты из проекта
	"dance-flow/server/go/middleware"
	"dance-flow/server/go/config"
)

func TestAuthMiddleware(t *testing.T) {
	// Устанавливаем тестовый режим Gin
	gin.SetMode(gin.TestMode)
	
	// Создаем временный JWT ключ для тестов
	originalJWTKey := config.JWTKey
	config.JWTKey = []byte("test_jwt_key")
	defer func() {
		// Восстанавливаем оригинальный ключ после тестов
		config.JWTKey = originalJWTKey
	}()
	
	// Создаем тестовый роутер
	router := gin.Default()
	
	// Добавляем protected route с middleware аутентификации
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware())
	protected.GET("/protected", func(c *gin.Context) {
		// Получаем пользователя из контекста, который должен быть добавлен middleware
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "userID not set"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "access granted", "userID": userID})
	})
	
	// Тестовые данные
	testCases := []struct {
		name           string
		authHeader     string
		expectedStatus int
		expectedUserID string
	}{
		{
			name:           "Valid Token",
			authHeader:     "", // Будет установлен позже с действительным токеном
			expectedStatus: http.StatusOK,
			expectedUserID: "507f1f77bcf86cd799439011", // Пример ObjectID
		},
		{
			name:           "No Token",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
			expectedUserID: "",
		},
		{
			name:           "Invalid Token Format",
			authHeader:     "Bearer invalid_token",
			expectedStatus: http.StatusUnauthorized,
			expectedUserID: "",
		},
		{
			name:           "Token With Wrong Signing Method",
			authHeader:     "", // Будет установлен позже с токеном с неправильным методом подписи
			expectedStatus: http.StatusUnauthorized,
			expectedUserID: "",
		},
		{
			name:           "Expired Token",
			authHeader:     "", // Будет установлен позже с просроченным токеном
			expectedStatus: http.StatusUnauthorized,
			expectedUserID: "",
		},
	}
	
	// Устанавливаем токены для тестовых случаев
	// Создаем действительный токен
	userID, _ := primitive.ObjectIDFromHex("507f1f77bcf86cd799439011")
	validToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":  userID.Hex(),
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	})
	validTokenString, _ := validToken.SignedString(config.JWTKey)
	testCases[0].authHeader = "Bearer " + validTokenString
	
	// Создаем токен с неправильным методом подписи
	wrongMethodToken := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"id":  userID.Hex(),
		"exp": time.Now().Add(time.Hour * 24).Unix(),
	})
	wrongMethodTokenString, _ := wrongMethodToken.SignedString(jwt.UnsafeAllowNoneSignatureType)
	testCases[3].authHeader = "Bearer " + wrongMethodTokenString
	
	// Создаем просроченный токен
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":  userID.Hex(),
		"exp": time.Now().Add(-time.Hour).Unix(), // Просрочен на час
	})
	expiredTokenString, _ := expiredToken.SignedString(config.JWTKey)
	testCases[4].authHeader = "Bearer " + expiredTokenString
	
	// Выполняем тестовые случаи
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Создаем тестовый запрос
			req, _ := http.NewRequest(http.MethodGet, "/api/protected", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}
			
			// Создаем рекордер для записи ответа
			w := httptest.NewRecorder()
			
			// Выполняем запрос
			router.ServeHTTP(w, req)
			
			// Проверяем статус ответа
			assert.Equal(t, tc.expectedStatus, w.Code)
			
			// Для успешных запросов проверяем тело ответа
			if tc.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "userID")
				assert.Equal(t, tc.expectedUserID, response["userID"])
			}
		})
	}
}

func TestRoleMiddleware(t *testing.T) {
	// Устанавливаем тестовый режим Gin
	gin.SetMode(gin.TestMode)
	
	// Создаем тестовый роутер
	router := gin.Default()
	
	// Добавляем protected route с middleware проверки роли
	// Сперва устанавливаем middleware авторизации для получения userID
	adminRoute := router.Group("/api/admin")
	adminRoute.Use(func(c *gin.Context) {
		// Имитируем middleware авторизации, добавляя userID и роль в контекст
		c.Set("userID", "507f1f77bcf86cd799439011")
		c.Set("userRole", c.Query("role")) // Роль получаем из query параметра для удобства тестирования
		c.Next()
	})
	
	// Добавляем middleware проверки роли
	adminRoute.Use(middleware.RequireRole("admin"))
	
	// Добавляем защищенный маршрут
	adminRoute.GET("/dashboard", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "admin access granted"})
	})
	
	// Тестовые случаи
	testCases := []struct {
		name           string
		role           string
		expectedStatus int
	}{
		{
			name:           "Admin Role",
			role:           "admin",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "User Role",
			role:           "user",
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "No Role",
			role:           "",
			expectedStatus: http.StatusForbidden,
		},
	}
	
	// Выполняем тестовые случаи
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Создаем тестовый запрос
			req, _ := http.NewRequest(http.MethodGet, "/api/admin/dashboard?role="+tc.role, nil)
			
			// Создаем рекордер для записи ответа
			w := httptest.NewRecorder()
			
			// Выполняем запрос
			router.ServeHTTP(w, req)
			
			// Проверяем статус ответа
			assert.Equal(t, tc.expectedStatus, w.Code)
			
			// Для успешных запросов проверяем тело ответа
			if tc.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Equal(t, "admin access granted", response["message"])
			}
		})
	}
} 