package services

import (
	"github.com/kktjss/dance-flow/models"
)

// ProjectService defines the interface for project service operations
type ProjectService interface {
	GetProjects(userID string) ([]models.Project, error)
	GetUserProjects(userID string) ([]models.Project, error)
	GetProjectByID(projectID string) (*models.Project, error)
	CreateProject(project *models.Project) (*models.Project, error)
	UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error)
	DeleteProject(projectID string) error
}
