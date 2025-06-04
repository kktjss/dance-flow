package services

import (
	"github.com/kktjss/dance-flow/models"
	"github.com/kktjss/dance-flow/repositories"
)

// DefaultProject represents a default project template
type DefaultProject struct {
	Name        string
	Description string
	DanceStyle  string
	Tags        []string
}

var defaultProjects = []DefaultProject{
	{
		Name:        "Базовые движения сальсы",
		Description: "Основные шаги и движения сальсы для начинающих",
		DanceStyle:  "salsa",
		Tags:        []string{"salsa", "beginner", "basics"},
	},
	{
		Name:        "Базовые движения бачаты",
		Description: "Основные шаги и движения бачаты для начинающих",
		DanceStyle:  "bachata",
		Tags:        []string{"bachata", "beginner", "basics"},
	},
}

// ProjectService defines the interface for project service operations
type ProjectService interface {
	GetProjects(userID string) ([]models.Project, error)
	GetUserProjects(userID string) ([]models.Project, error)
	GetProjectByID(projectID string) (*models.Project, error)
	CreateProject(project *models.Project) (*models.Project, error)
	UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error)
	DeleteProject(projectID string) error
	CreateDefaultProjects(userID string) error
}

// projectService implements ProjectService
type projectService struct {
	repo repositories.ProjectRepository
}

// NewProjectService creates a new project service
func NewProjectService(repo repositories.ProjectRepository) ProjectService {
	return &projectService{
		repo: repo,
	}
}

// GetProjects returns all projects for a user (including public projects)
func (s *projectService) GetProjects(userID string) ([]models.Project, error) {
	return s.repo.FindAll(userID)
}

// GetUserProjects returns all projects owned by a user
func (s *projectService) GetUserProjects(userID string) ([]models.Project, error) {
	return s.repo.FindByUserID(userID)
}

// GetProjectByID returns a project by ID
func (s *projectService) GetProjectByID(projectID string) (*models.Project, error) {
	return s.repo.FindByID(projectID)
}

// CreateProject creates a new project
func (s *projectService) CreateProject(project *models.Project) (*models.Project, error) {
	return s.repo.Create(project)
}

// UpdateProject updates an existing project
func (s *projectService) UpdateProject(projectID string, updates map[string]interface{}) (*models.Project, error) {
	return s.repo.Update(projectID, updates)
}

// DeleteProject deletes a project
func (s *projectService) DeleteProject(projectID string) error {
	return s.repo.Delete(projectID)
}

// CreateDefaultProjects creates default projects for a new user
func (s *projectService) CreateDefaultProjects(userID string) error {
	for _, defaultProj := range defaultProjects {
		project := &models.Project{
			Name:        defaultProj.Name,
			Description: defaultProj.Description,
			UserID:      userID,
			DanceStyle:  defaultProj.DanceStyle,
			Tags:        defaultProj.Tags,
			IsPrivate:   false, // Default projects are public
		}
		
		_, err := s.CreateProject(project)
		if err != nil {
			return err
		}
	}
	
	return nil
}
