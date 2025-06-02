package mocks

import (
	"github.com/kktjss/dance-flow/models"
	"github.com/stretchr/testify/mock"
)

// MockProjectService is a mock implementation of the ProjectService interface
type MockProjectService struct {
	mock.Mock
}

// GetProjects returns all projects for the authenticated user
func (m *MockProjectService) GetProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

// GetUserProjects returns all projects for a specific user
func (m *MockProjectService) GetUserProjects(userID string) ([]models.Project, error) {
	args := m.Called(userID)
	return args.Get(0).([]models.Project), args.Error(1)
}

// GetProjectByID returns a project by ID
func (m *MockProjectService) GetProjectByID(projectID string) (*models.Project, error) {
	args := m.Called(projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

// CreateProject creates a new project
func (m *MockProjectService) CreateProject(project *models.Project) (*models.Project, error) {
	args := m.Called(project)
	return args.Get(0).(*models.Project), args.Error(1)
}

// UpdateProject updates an existing project
func (m *MockProjectService) UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error) {
	args := m.Called(projectID, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Project), args.Error(1)
}

// DeleteProject deletes a project
func (m *MockProjectService) DeleteProject(projectID string) error {
	args := m.Called(projectID)
	return args.Error(0)
} 