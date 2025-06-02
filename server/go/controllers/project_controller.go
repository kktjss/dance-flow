package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/models"
	"github.com/kktjss/dance-flow/services"
)

// ProjectController handles HTTP requests related to projects
type ProjectController struct {
	projectService services.ProjectService
}

// NewProjectController creates a new project controller
func NewProjectController(projectService services.ProjectService) *ProjectController {
	return &ProjectController{
		projectService: projectService,
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
	var project models.Project
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
