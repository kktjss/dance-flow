package unit

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"dance-flow/server/go/controllers"
	"dance-flow/server/go/models"
	"dance-flow/server/go/services"
)

// Создаем мок сервиса проектов
type MockProjectService struct {
	mock.Mock
}

func (m *MockProjectService) GetProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

func (m *MockProjectService) GetUserProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

func (m *MockProjectService) GetProjectByID(projectID string) (*models.Project, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

func (m *MockProjectService) CreateProject(project *models.Project) (*models.Project, error) {
	args := m.Called(project)
	return args.Get(0).(*models.Project), args.Error(1)
}

func (m *MockProjectService) UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error) {
	args := m.Called(projectID, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

func (m *MockProjectService) DeleteProject(projectID string) error {
	args := m.Called(projectID)
	return args.Error(0)
}

func TestProjectController_GetProjects(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	testProjects := []models.Project{
		{
			ID:          "project1",
			Name:        "Test Project 1",
			Description: "Description for project 1",
			UserID:      "user123",
			DanceStyle:  "salsa",
			Tags:        []string{"beginner", "practice"},
			IsPrivate:   false,
		},
		{
			ID:          "project2",
			Name:        "Test Project 2",
			Description: "Description for project 2",
			UserID:      "user123",
			DanceStyle:  "bachata",
			Tags:        []string{"intermediate", "performance"},
			IsPrivate:   true,
		},
	}

	// Настраиваем ожидание для метода GetProjects
	mockService.On("GetProjects", "user123").Return(testProjects, nil)

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый запрос
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})

	// Регистрируем маршрут
	router.GET("/api/projects", controller.GetProjects)

	// Выполняем запрос
	req, _ := http.NewRequest(http.MethodGet, "/api/projects", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusOK, resp.Code)

	// Проверяем содержимое ответа
	var projects []models.Project
	err := json.Unmarshal(resp.Body.Bytes(), &projects)
	assert.NoError(t, err)
	assert.Len(t, projects, 2)
	assert.Equal(t, "Test Project 1", projects[0].Name)
	assert.Equal(t, "Test Project 2", projects[1].Name)

	// Проверяем, что метод сервиса был вызван
	mockService.AssertExpectations(t)
}

func TestProjectController_GetProjectByID(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	testProject := &models.Project{
		ID:          "project1",
		Name:        "Test Project 1",
		Description: "Description for project 1",
		UserID:      "user123",
		DanceStyle:  "salsa",
		Tags:        []string{"beginner", "practice"},
		IsPrivate:   false,
	}

	// Настраиваем ожидания для метода GetProjectByID
	mockService.On("GetProjectByID", "project1").Return(testProject, nil)
	mockService.On("GetProjectByID", "nonexistent").Return(nil, errors.New("project not found"))

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.GET("/api/projects/:id", controller.GetProjectByID)

	// Тест 1: Успешное получение проекта по ID
	req1, _ := http.NewRequest(http.MethodGet, "/api/projects/project1", nil)
	resp1 := httptest.NewRecorder()
	router.ServeHTTP(resp1, req1)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusOK, resp1.Code)

	// Проверяем содержимое ответа
	var project models.Project
	err := json.Unmarshal(resp1.Body.Bytes(), &project)
	assert.NoError(t, err)
	assert.Equal(t, "Test Project 1", project.Name)
	assert.Equal(t, "project1", project.ID)

	// Тест 2: Проект не найден
	req2, _ := http.NewRequest(http.MethodGet, "/api/projects/nonexistent", nil)
	resp2 := httptest.NewRecorder()
	router.ServeHTTP(resp2, req2)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusNotFound, resp2.Code)

	// Проверяем, что методы сервиса были вызваны
	mockService.AssertExpectations(t)
}

func TestProjectController_CreateProject(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	testProject := &models.Project{
		Name:        "New Project",
		Description: "Description for new project",
		UserID:      "user123",
		DanceStyle:  "salsa",
		Tags:        []string{"beginner", "practice"},
		IsPrivate:   false,
	}

	// После создания проект должен иметь ID
	createdProject := &models.Project{
		ID:          "new-project-id",
		Name:        "New Project",
		Description: "Description for new project",
		UserID:      "user123",
		DanceStyle:  "salsa",
		Tags:        []string{"beginner", "practice"},
		IsPrivate:   false,
	}

	// Настраиваем ожидание для метода CreateProject
	mockService.On("CreateProject", mock.AnythingOfType("*models.Project")).Return(createdProject, nil)

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.POST("/api/projects", controller.CreateProject)

	// Создаем тело запроса
	reqBody, _ := json.Marshal(testProject)

	// Выполняем запрос
	req, _ := http.NewRequest(http.MethodPost, "/api/projects", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusCreated, resp.Code)

	// Проверяем содержимое ответа
	var project models.Project
	err := json.Unmarshal(resp.Body.Bytes(), &project)
	assert.NoError(t, err)
	assert.Equal(t, "New Project", project.Name)
	assert.Equal(t, "new-project-id", project.ID)

	// Проверяем, что метод сервиса был вызван
	mockService.AssertExpectations(t)
}

func TestProjectController_UpdateProject(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	updatedProject := &models.Project{
		ID:          "project1",
		Name:        "Updated Project",
		Description: "Updated description",
		UserID:      "user123",
		DanceStyle:  "bachata",
		Tags:        []string{"intermediate", "performance"},
		IsPrivate:   true,
	}

	// Данные для обновления
	updates := map[string]interface{}{
		"name":        "Updated Project",
		"description": "Updated description",
		"danceStyle":  "bachata",
		"tags":        []string{"intermediate", "performance"},
		"isPrivate":   true,
	}

	// Настраиваем ожидания для метода UpdateProject
	mockService.On("GetProjectByID", "project1").Return(updatedProject, nil)
	mockService.On("UpdateProject", "project1", mock.AnythingOfType("map[string]interface {}")).Return(updatedProject, nil)
	mockService.On("GetProjectByID", "nonexistent").Return(nil, errors.New("project not found"))

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.PUT("/api/projects/:id", controller.UpdateProject)

	// Тест 1: Успешное обновление проекта
	reqBody, _ := json.Marshal(updates)
	req1, _ := http.NewRequest(http.MethodPut, "/api/projects/project1", bytes.NewBuffer(reqBody))
	req1.Header.Set("Content-Type", "application/json")
	resp1 := httptest.NewRecorder()
	router.ServeHTTP(resp1, req1)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusOK, resp1.Code)

	// Проверяем содержимое ответа
	var project models.Project
	err := json.Unmarshal(resp1.Body.Bytes(), &project)
	assert.NoError(t, err)
	assert.Equal(t, "Updated Project", project.Name)
	assert.Equal(t, "bachata", project.DanceStyle)

	// Тест 2: Проект не найден
	req2, _ := http.NewRequest(http.MethodPut, "/api/projects/nonexistent", bytes.NewBuffer(reqBody))
	req2.Header.Set("Content-Type", "application/json")
	resp2 := httptest.NewRecorder()
	router.ServeHTTP(resp2, req2)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusNotFound, resp2.Code)

	// Проверяем, что методы сервиса были вызваны
	mockService.AssertExpectations(t)
}

func TestProjectController_DeleteProject(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем проект для теста доступа
	testProject := &models.Project{
		ID:          "project1",
		Name:        "Test Project",
		Description: "Description for test project",
		UserID:      "user123",
		DanceStyle:  "salsa",
		IsPrivate:   false,
	}

	// Настраиваем ожидания для методов
	mockService.On("GetProjectByID", "project1").Return(testProject, nil)
	mockService.On("DeleteProject", "project1").Return(nil)
	mockService.On("GetProjectByID", "nonexistent").Return(nil, errors.New("project not found"))
	mockService.On("GetProjectByID", "other-user-project").Return(&models.Project{
		ID:     "other-user-project",
		UserID: "other-user",
	}, nil)

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.DELETE("/api/projects/:id", controller.DeleteProject)

	// Тест 1: Успешное удаление проекта
	req1, _ := http.NewRequest(http.MethodDelete, "/api/projects/project1", nil)
	resp1 := httptest.NewRecorder()
	router.ServeHTTP(resp1, req1)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusOK, resp1.Code)

	// Проверяем содержимое ответа
	var response map[string]string
	err := json.Unmarshal(resp1.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "message")
	assert.Equal(t, "Project deleted successfully", response["message"])

	// Тест 2: Проект не найден
	req2, _ := http.NewRequest(http.MethodDelete, "/api/projects/nonexistent", nil)
	resp2 := httptest.NewRecorder()
	router.ServeHTTP(resp2, req2)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusNotFound, resp2.Code)

	// Тест 3: Нет доступа к проекту другого пользователя
	req3, _ := http.NewRequest(http.MethodDelete, "/api/projects/other-user-project", nil)
	resp3 := httptest.NewRecorder()
	router.ServeHTTP(resp3, req3)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusForbidden, resp3.Code)

	// Проверяем, что методы сервиса были вызваны
	mockService.AssertExpectations(t)
}

func TestProjectController_Validation(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.POST("/api/projects", controller.CreateProject)

	// Тест: Недостаточные данные для создания проекта
	invalidProject := map[string]interface{}{
		// Отсутствует обязательное поле name
		"description": "Invalid project without name",
	}
	reqBody, _ := json.Marshal(invalidProject)
	req, _ := http.NewRequest(http.MethodPost, "/api/projects", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusBadRequest, resp.Code)

	// Проверяем содержимое ответа на наличие сообщения об ошибке валидации
	var response map[string]interface{}
	err := json.Unmarshal(resp.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "error")
	assert.Contains(t, response["error"], "name")
}

func TestProjectController_GetUserProjects(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	testProjects := []models.Project{
		{
			ID:          "project1",
			Name:        "Test Project 1",
			Description: "Description for project 1",
			UserID:      "target-user",
			DanceStyle:  "salsa",
			Tags:        []string{"beginner", "practice"},
			IsPrivate:   false,
		},
	}

	// Настраиваем ожидание для метода GetUserProjects
	mockService.On("GetUserProjects", "target-user").Return(testProjects, nil)

	// Создаем контроллер с мок-сервисом
	controller := controllers.NewProjectController(mockService)

	// Создаем тестовый роутер
	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Имитируем middleware для аутентификации
		c.Set("userID", "user123")
		c.Next()
	})
	router.GET("/api/users/:id/projects", controller.GetUserProjects)

	// Выполняем запрос
	req, _ := http.NewRequest(http.MethodGet, "/api/users/target-user/projects", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	// Проверяем статус-код ответа
	assert.Equal(t, http.StatusOK, resp.Code)

	// Проверяем содержимое ответа
	var projects []models.Project
	err := json.Unmarshal(resp.Body.Bytes(), &projects)
	assert.NoError(t, err)
	assert.Len(t, projects, 1)
	assert.Equal(t, "Test Project 1", projects[0].Name)
	assert.Equal(t, "target-user", projects[0].UserID)

	// Проверяем, что метод сервиса был вызван
	mockService.AssertExpectations(t)
} 