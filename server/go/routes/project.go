package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// RegisterProjectRoutes registers all project routes
func RegisterProjectRoutes(router *gin.RouterGroup, cfg *config.Config) {
	projects := router.Group("/projects")
	projects.Use(middleware.JWTMiddleware(cfg))
	{
		projects.GET("", getProjects)
		projects.POST("", createProject)
		projects.GET("/:id", middleware.CheckProjectIsPrivate(), getProject)
		projects.PUT("/:id", middleware.CheckProjectAccess(), updateProject)
		projects.DELETE("/:id", middleware.CheckProjectAccess(), deleteProject)
	}
}

// getProjects returns all projects accessible by the authenticated user
func getProjects(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get user's team memberships to find team projects
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user data"})
		return
	}

	// Create a list of team IDs the user is a member of
	var teamIDs []primitive.ObjectID
	for _, team := range user.Teams {
		teamIDs = append(teamIDs, team)
	}

	// Query filter: user's own projects OR projects from teams they belong to
	filter := bson.M{
		"$or": []bson.M{
			{"owner": userID},
		},
	}

	// Add team projects if the user belongs to any teams
	if len(teamIDs) > 0 {
		filter["$or"] = append(filter["$or"].([]bson.M), bson.M{"teamId": bson.M{"$in": teamIDs}})
	}

	// Get all matching projects
	findOptions := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.ProjectsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get projects"})
		return
	}
	defer cursor.Close(ctx)

	// Decode projects
	var projects []models.Project
	if err := cursor.All(ctx, &projects); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// getProject returns a single project by ID if the user has access
func getProject(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// createProject creates a new project for the authenticated user
func createProject(c *gin.Context) {
	var input models.ProjectCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create project
	project := models.Project{
		ID:          primitive.NewObjectID(),
		Name:        input.Name,
		Description: input.Description,
		Owner:       userID,
		Tags:        input.Tags,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsPrivate:   input.IsPrivate,
		Title:       input.Title,
	}

	// Add team ID if provided
	if input.TeamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(input.TeamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			return
		}
		project.TeamID = teamObjID
	}

	// Insert project into database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.ProjectsCollection.InsertOne(ctx, project)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	// Add history entry for project creation
	historyEntry := models.CreateHistory(
		userID,
		project.ID,
		models.ActionProjectCreated,
		fmt.Sprintf("Created project '%s'", project.Name),
	)
	
	historyCollection := config.GetCollection("histories")
	_, err = historyCollection.InsertOne(ctx, historyEntry)
	if err != nil {
		// Log the error but don't fail the request
		config.LogError("PROJECT", fmt.Errorf("failed to create history entry: %w", err))
	}

	c.JSON(http.StatusCreated, project)
}

// updateProject updates a project if the user has access
func updateProject(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	var input models.ProjectUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Build update document
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	// Add optional fields if provided
	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}
	if input.Description != "" {
		update["$set"].(bson.M)["description"] = input.Description
	}
	if input.VideoURL != "" {
		update["$set"].(bson.M)["videoUrl"] = input.VideoURL
	}
	if input.Tags != nil {
		update["$set"].(bson.M)["tags"] = input.Tags
	}
	if input.Title != "" {
		update["$set"].(bson.M)["title"] = input.Title
	}
	if input.IsPrivate != nil {
		update["$set"].(bson.M)["isPrivate"] = *input.IsPrivate
	}
	if input.TeamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(input.TeamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			return
		}
		update["$set"].(bson.M)["teamId"] = teamObjID
	}

	// Update project
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		update,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Get updated project
	var updatedProject models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&updatedProject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated project"})
		return
	}

	c.JSON(http.StatusOK, updatedProject)
}

// deleteProject deletes a project if the user has access
func deleteProject(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := config.ProjectsCollection.DeleteOne(ctx, bson.M{"_id": projectObjID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
} 