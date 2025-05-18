package unit

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	
	// Импортируем нужные пакеты из проекта
	"dance-flow/server/go/models"
	"dance-flow/server/go/routes"
)

func TestLogin(t *testing.T) {
	// Устанавливаем тестовый режим Gin
	gin.SetMode(gin.TestMode)
	
	// Создаем тестовый роутер
	router := gin.Default()
	routes.SetupAuthRoutes(router.Group("/api/auth"))
	
	// Тестовые данные
	testCases := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedError  bool
	}{
		{
			name:           "Valid Login",
			requestBody:    `{"username":"testuser","password":"password123"}`,
			expectedStatus: http.StatusOK,
			expectedError:  false,
		},
		{
			name:           "Invalid Username",
			requestBody:    `{"username":"nonexistent","password":"password123"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  true,
		},
		{
			name:           "Invalid Password",
			requestBody:    `{"username":"testuser","password":"wrongpassword"}`,
			expectedStatus: http.StatusUnauthorized,
			expectedError:  true,
		},
		{
			name:           "Missing Fields",
			requestBody:    `{"username":""}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}
	
	// Выполняем тестовые случаи
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Создаем тестовый запрос
			req, err := http.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(tc.requestBody))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			
			// Создаем рекордер для записи ответа
			w := httptest.NewRecorder()
			
			// Выполняем запрос
			router.ServeHTTP(w, req)
			
			// Проверяем статус ответа
			assert.Equal(t, tc.expectedStatus, w.Code)
			
			// Проверяем содержимое ответа
			if tc.expectedError {
				var response map[string]string
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "error")
			} else {
				var response map[string]interface{}
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "token")
				assert.Contains(t, response, "user")
			}
		})
	}
}

func TestRegister(t *testing.T) {
	// Устанавливаем тестовый режим Gin
	gin.SetMode(gin.TestMode)
	
	// Создаем тестовый роутер
	router := gin.Default()
	routes.SetupAuthRoutes(router.Group("/api/auth"))
	
	// Тестовые данные
	testCases := []struct {
		name           string
		requestBody    string
		expectedStatus int
		expectedError  bool
	}{
		{
			name:           "Valid Registration",
			requestBody:    `{"username":"newuser","email":"newuser@example.com","password":"password123"}`,
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name:           "Duplicate Username",
			requestBody:    `{"username":"testuser","email":"another@example.com","password":"password123"}`,
			expectedStatus: http.StatusConflict,
			expectedError:  true,
		},
		{
			name:           "Invalid Email",
			requestBody:    `{"username":"newuser2","email":"invalid","password":"password123"}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name:           "Missing Required Fields",
			requestBody:    `{"username":""}`,
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
	}
	
	// Выполняем тестовые случаи
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Создаем тестовый запрос
			req, err := http.NewRequest(http.MethodPost, "/api/auth/register", strings.NewReader(tc.requestBody))
			assert.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			
			// Создаем рекордер для записи ответа
			w := httptest.NewRecorder()
			
			// Выполняем запрос
			router.ServeHTTP(w, req)
			
			// Проверяем статус ответа
			assert.Equal(t, tc.expectedStatus, w.Code)
			
			// Проверяем содержимое ответа
			if tc.expectedError {
				var response map[string]string
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "error")
			} else {
				var response map[string]interface{}
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.Contains(t, response, "user")
			}
		})
	}
} 