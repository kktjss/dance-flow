package mocks

import (
	"github.com/kktjss/dance-flow/models"
	"github.com/stretchr/testify/mock"
)

// MockProjectService это мок-реализация интерфейса ProjectService
type MockProjectService struct {
	mock.Mock
}

// GetProjects возвращает все проекты для аутентифицированного пользователя
func (m *MockProjectService) GetProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

// GetUserProjects возвращает все проекты для конкретного пользователя
func (m *MockProjectService) GetUserProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

// GetProjectByID возвращает проект по ID
func (m *MockProjectService) GetProjectByID(projectID string) (*models.Project, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

// CreateProject создает новый проект
func (m *MockProjectService) CreateProject(project *models.Project) (*models.Project, error) {
	args := m.Called(project)
	return args.Get(0).(*models.Project), args.Error(1)
}

// UpdateProject обновляет существующий проект
func (m *MockProjectService) UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error) {
	args := m.Called(projectID, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

// DeleteProject удаляет проект
func (m *MockProjectService) DeleteProject(projectID string) error {
	args := m.Called(projectID)
	return args.Error(0)
} 