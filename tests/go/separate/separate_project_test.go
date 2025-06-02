package separate

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Project represents a dance project
type Project struct {
	ID          string   `json:"id" bson:"_id,omitempty"`
	Name        string   `json:"name" bson:"name"`
	Description string   `json:"description" bson:"description"`
	UserID      string   `json:"userId" bson:"userId"`
	DanceStyle  string   `json:"danceStyle" bson:"danceStyle"`
	Tags        []string `json:"tags" bson:"tags"`
	IsPrivate   bool     `json:"isPrivate" bson:"isPrivate"`
}

// MockProjectService is a mock implementation of the ProjectService interface
type MockProjectService struct {
	mock.Mock
}

// GetProjects returns all projects for the authenticated user
func (m *MockProjectService) GetProjects(userID string) ([]Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]Project), args.Error(1)
}

// GetUserProjects returns all projects for a specific user
func (m *MockProjectService) GetUserProjects(userID string) ([]Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]Project), args.Error(1)
}

// GetProjectByID returns a project by ID
func (m *MockProjectService) GetProjectByID(projectID string) (*Project, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Project), args.Error(1)
}

// CreateProject creates a new project
func (m *MockProjectService) CreateProject(project *Project) (*Project, error) {
	args := m.Called(project)
	return args.Get(0).(*Project), args.Error(1)
}

// UpdateProject updates an existing project
func (m *MockProjectService) UpdateProject(projectID string, updates map[string]interface{}) (*Project, error) {
	args := m.Called(projectID, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Project), args.Error(1)
}

// DeleteProject deletes a project
func (m *MockProjectService) DeleteProject(projectID string) error {
	args := m.Called(projectID)
	return args.Error(0)
}

// ProjectController handles HTTP requests related to projects
type ProjectController struct {
	projectService MockProjectService
}

// NewProjectController creates a new project controller
func NewProjectController(projectService *MockProjectService) *ProjectController {
	return &ProjectController{
		projectService: *projectService,
	}
}

// GetProjects returns all projects for the authenticated user
func (pc *ProjectController) GetProjects(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	projects, err := pc.projectService.GetProjects(userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// GetProjectByID returns a project by ID
func (pc *ProjectController) GetProjectByID(c *gin.Context) {
	projectID := c.Param("id")
	project, err := pc.projectService.GetProjectByID(projectID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// CreateProject creates a new project
func (pc *ProjectController) CreateProject(c *gin.Context) {
	var project Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	project.UserID = userID.(string)

	savedProject, err := pc.projectService.CreateProject(&project)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, savedProject)
}

// UpdateProject updates an existing project
func (pc *ProjectController) UpdateProject(c *gin.Context) {
	projectID := c.Param("id")
	var updates map[string]interface{}

	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updatedProject, err := pc.projectService.UpdateProject(projectID, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedProject)
}

// DeleteProject deletes a project
func (pc *ProjectController) DeleteProject(c *gin.Context) {
	projectID := c.Param("id")
	
	err := pc.projectService.DeleteProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// GetUserProjects returns all projects for a specific user
func (pc *ProjectController) GetUserProjects(c *gin.Context) {
	userID := c.Param("userId")
	
	projects, err := pc.projectService.GetUserProjects(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, projects)
}

func TestProjectController_GetProjects(t *testing.T) {
	// Настраиваем Gin в тестовом режиме
	gin.SetMode(gin.TestMode)

	// Создаем мок-сервис проектов
	mockService := new(MockProjectService)

	// Создаем тестовые данные
	testProjects := []Project{
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
	controller := NewProjectController(mockService)

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
	var projects []Project
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
	testProject := &Project{
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
	controller := NewProjectController(mockService)

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
	var project Project
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