package repositories

import (
	"github.com/kktjss/dance-flow/models"
)

// ProjectRepository defines the interface for project data access
type ProjectRepository interface {
	FindAll(userID string) ([]models.Project, error)
	FindByUserID(userID string) ([]models.Project, error)
	FindByID(projectID string) (*models.Project, error)
	Create(project *models.Project) (*models.Project, error)
	Update(projectID string, updates map[string]interface{}) (*models.Project, error)
	Delete(projectID string) error
}
