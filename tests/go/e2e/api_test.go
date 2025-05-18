package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/suite"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/bson"

	"dance-flow/server/go/models"
)

// APIURL представляет базовый URL API для тестирования
const APIURL = "http://localhost:5000"

// APITestSuite содержит состояние и вспомогательные функции для тестирования API
type APITestSuite struct {
	suite.Suite
	client       *http.Client
	mongoClient  *mongo.Client
	testDB       *mongo.Database
	testUser     *models.User
	authToken    string
	createdItems map[string]string // Для хранения созданных во время теста ресурсов
}

func (s *APITestSuite) SetupSuite() {
	// Инициализация HTTP клиента
	s.client = &http.Client{
		Timeout: 10 * time.Second,
	}
	
	// Подключение к тестовой базе данных
	mongoURI := os.Getenv("MONGO_TEST_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	
	clientOptions := options.Client().ApplyURI(mongoURI)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	var err error
	s.mongoClient, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		s.T().Fatalf("Failed to connect to MongoDB: %v", err)
	}
	
	// Используем отдельную тестовую базу данных
	s.testDB = s.mongoClient.Database("dance_flow_e2e_test")
	
	// Инициализация карты для отслеживания созданных ресурсов
	s.createdItems = make(map[string]string)
}

func (s *APITestSuite) TearDownSuite() {
	// Удаляем тестовую базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	err := s.testDB.Drop(ctx)
	if err != nil {
		s.T().Logf("Failed to drop test database: %v", err)
	}
	
	// Отключаемся от MongoDB
	err = s.mongoClient.Disconnect(ctx)
	if err != nil {
		s.T().Logf("Failed to disconnect from MongoDB: %v", err)
	}
}

func (s *APITestSuite) registerTestUser() {
	// Подготавливаем данные для регистрации пользователя
	timestamp := time.Now().UnixNano()
	username := fmt.Sprintf("testuser_%d", timestamp)
	email := fmt.Sprintf("test_%d@example.com", timestamp)
	password := "Password123!"
	
	// Создаем запрос на регистрацию
	registerData := map[string]string{
		"username": username,
		"email":    email,
		"password": password,
	}
	jsonData, _ := json.Marshal(registerData)
	
	// Отправляем запрос
	resp, err := s.client.Post(
		fmt.Sprintf("%s/api/auth/register", APIURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	
	// Проверяем успешность запроса
	if err != nil || resp.StatusCode != http.StatusCreated {
		s.T().Fatalf("Failed to register test user: %v, status: %v", err, resp.StatusCode)
	}
	defer resp.Body.Close()
	
	// Парсим ответ
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	// Сохраняем данные пользователя
	userData, ok := result["user"].(map[string]interface{})
	if !ok {
		s.T().Fatalf("Failed to parse user data from response")
	}
	
	s.testUser = &models.User{
		Username: username,
		Email:    email,
	}
	
	// Сохраняем ID пользователя
	if userID, ok := userData["_id"].(string); ok {
		s.createdItems["user_id"] = userID
	}
	
	// Логинимся, чтобы получить токен
	s.loginTestUser(username, password)
}

func (s *APITestSuite) loginTestUser(username, password string) {
	// Подготавливаем данные для логина
	loginData := map[string]string{
		"username": username,
		"password": password,
	}
	jsonData, _ := json.Marshal(loginData)
	
	// Отправляем запрос
	resp, err := s.client.Post(
		fmt.Sprintf("%s/api/auth/login", APIURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	
	// Проверяем успешность запроса
	if err != nil || resp.StatusCode != http.StatusOK {
		s.T().Fatalf("Failed to login: %v, status: %v", err, resp.StatusCode)
	}
	defer resp.Body.Close()
	
	// Парсим ответ
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	// Сохраняем токен авторизации
	if token, ok := result["token"].(string); ok {
		s.authToken = token
	} else {
		s.T().Fatalf("No token in login response")
	}
}

func (s *APITestSuite) createTestProject() {
	// Проверяем наличие токена
	if s.authToken == "" {
		s.T().Fatalf("No auth token available")
	}
	
	// Подготавливаем данные для создания проекта
	projectData := map[string]interface{}{
		"name":        "Test E2E Project",
		"description": "Project created for E2E testing",
		"isPrivate":   false,
		"tags":        []string{"test", "e2e"},
	}
	jsonData, _ := json.Marshal(projectData)
	
	// Создаем запрос
	req, _ := http.NewRequest(
		http.MethodPost,
		fmt.Sprintf("%s/api/projects", APIURL),
		bytes.NewBuffer(jsonData),
	)
	
	// Добавляем заголовки
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
	
	// Отправляем запрос
	resp, err := s.client.Do(req)
	
	// Проверяем успешность запроса
	if err != nil || resp.StatusCode != http.StatusCreated {
		s.T().Fatalf("Failed to create test project: %v, status: %v", err, resp.StatusCode)
	}
	defer resp.Body.Close()
	
	// Парсим ответ
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	
	// Сохраняем ID проекта
	if projectID, ok := result["_id"].(string); ok {
		s.createdItems["project_id"] = projectID
	} else {
		s.T().Fatalf("No project ID in response")
	}
}

func (s *APITestSuite) TestFullUserFlow() {
	// 1. Регистрация нового пользователя
	s.registerTestUser()
	s.Require().NotEmpty(s.authToken, "Auth token should be set after login")
	
	// 2. Создание проекта
	s.createTestProject()
	s.Require().NotEmpty(s.createdItems["project_id"], "Project ID should be set after creation")
	
	// 3. Получение списка проектов
	s.T().Run("Get Projects List", func(t *testing.T) {
		req, _ := http.NewRequest(
			http.MethodGet,
			fmt.Sprintf("%s/api/projects", APIURL),
			nil,
		)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get projects: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusOK, resp.StatusCode)
		
		var projects []interface{}
		json.NewDecoder(resp.Body).Decode(&projects)
		s.NotEmpty(projects, "Projects list should not be empty")
	})
	
	// 4. Получение информации о созданном проекте
	s.T().Run("Get Project Details", func(t *testing.T) {
		req, _ := http.NewRequest(
			http.MethodGet,
			fmt.Sprintf("%s/api/projects/%s", APIURL, s.createdItems["project_id"]),
			nil,
		)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get project details: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusOK, resp.StatusCode)
		
		var project map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&project)
		s.Equal(s.createdItems["project_id"], project["_id"], "Project ID should match")
		s.Equal("Test E2E Project", project["name"], "Project name should match")
	})
	
	// 5. Обновление проекта
	s.T().Run("Update Project", func(t *testing.T) {
		updateData := map[string]interface{}{
			"name":        "Updated E2E Project",
			"description": "Project updated during E2E testing",
		}
		jsonData, _ := json.Marshal(updateData)
		
		req, _ := http.NewRequest(
			http.MethodPut,
			fmt.Sprintf("%s/api/projects/%s", APIURL, s.createdItems["project_id"]),
			bytes.NewBuffer(jsonData),
		)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to update project: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusOK, resp.StatusCode)
		
		var updatedProject map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&updatedProject)
		s.Equal("Updated E2E Project", updatedProject["name"], "Project name should be updated")
		s.Equal("Project updated during E2E testing", updatedProject["description"], "Project description should be updated")
	})
	
	// 6. Удаление проекта
	s.T().Run("Delete Project", func(t *testing.T) {
		req, _ := http.NewRequest(
			http.MethodDelete,
			fmt.Sprintf("%s/api/projects/%s", APIURL, s.createdItems["project_id"]),
			nil,
		)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to delete project: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusOK, resp.StatusCode)
		
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		s.Contains(result, "message", "Response should contain a message field")
	})
	
	// 7. Проверка, что проект действительно удален
	s.T().Run("Verify Project Deletion", func(t *testing.T) {
		req, _ := http.NewRequest(
			http.MethodGet,
			fmt.Sprintf("%s/api/projects/%s", APIURL, s.createdItems["project_id"]),
			nil,
		)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get project details: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusNotFound, resp.StatusCode)
	})
	
	// 8. Проверка профиля пользователя
	s.T().Run("Get User Profile", func(t *testing.T) {
		req, _ := http.NewRequest(
			http.MethodGet,
			fmt.Sprintf("%s/api/users/me", APIURL),
			nil,
		)
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.authToken))
		
		resp, err := s.client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get user profile: %v", err)
		}
		defer resp.Body.Close()
		
		s.Equal(http.StatusOK, resp.StatusCode)
		
		var userData map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&userData)
		s.Equal(s.testUser.Username, userData["username"], "Username should match")
		s.Equal(s.testUser.Email, userData["email"], "Email should match")
	})
}

// TestAPIFlow запускает тестовый сьют
func TestAPIFlow(t *testing.T) {
	// Проверяем, что тесты не запускаются автоматически в CI для предотвращения конфликтов
	if os.Getenv("CI") != "" && os.Getenv("RUN_E2E_TESTS") != "true" {
		t.Skip("Skipping E2E tests in CI environment")
	}
	
	suite.Run(t, new(APITestSuite))
} 