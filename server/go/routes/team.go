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

// RegisterTeamRoutes registers all team routes
func RegisterTeamRoutes(router *gin.RouterGroup, cfg *config.Config) {
	teams := router.Group("/teams")
	teams.Use(middleware.JWTMiddleware(cfg))
	{
		teams.GET("", getTeams)
		teams.POST("", createTeam)
		teams.GET("/:id", middleware.CheckTeamAccess(), getTeam)
		teams.PUT("/:id", middleware.CheckTeamAccess(), updateTeam)
		teams.DELETE("/:id", middleware.CheckTeamAccess(), deleteTeam)
		
		// Team members management
		teams.GET("/:id/members", middleware.CheckTeamAccess(), getTeamMembers)
		teams.POST("/:id/members", middleware.CheckTeamAccess(), addTeamMember)
		teams.DELETE("/:id/members/:userId", middleware.CheckTeamAccess(), removeTeamMember)
		
		// Team projects management
		teams.GET("/:id/projects", middleware.CheckTeamAccess(), getTeamProjects)
		teams.POST("/:id/projects", middleware.CheckTeamAccess(), addProjectToTeam)
		teams.DELETE("/:id/projects/:projectId", middleware.CheckTeamAccess(), removeProjectFromTeam)
		teams.GET("/:id/projects/:projectId/viewer", middleware.CheckTeamAccess(), getTeamProjectViewer)
		
		// Add a test endpoint
		teams.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Team routes are working"})
		})
	}
}

// getTeams returns all teams accessible by the authenticated user
func getTeams(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Query filter: teams where user is owner OR member
	filter := bson.M{
		"$or": []bson.M{
			{"owner": userID},           // User is team owner
			{"members.userId": userID},  // User is team member
		},
	}

	// Get all matching teams
	findOptions := options.Find().SetSort(bson.M{"name": 1})
	cursor, err := config.TeamsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get teams"})
		return
	}
	defer cursor.Close(ctx)

	// Decode teams
	var teams []models.Team
	if err := cursor.All(ctx, &teams); err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to decode teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode teams"})
		return
	}

	c.JSON(http.StatusOK, teams)
}

// getTeam returns a single team by ID if the user has access
func getTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert team ID to ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find team by ID, ensuring user has access
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},           // User is owner
			{"members.userId": userID},  // User is member
		},
	}).Decode(&team)

	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found or access denied"})
		return
	}

	// Populate projects with full project objects
	if len(team.Projects) > 0 {
		var projectIDs []primitive.ObjectID
		for _, projectIDStr := range team.Projects {
			projectID, err := primitive.ObjectIDFromHex(projectIDStr)
			if err != nil {
				continue // Skip invalid IDs
			}
			projectIDs = append(projectIDs, projectID)
		}

		if len(projectIDs) > 0 {
			// Find all projects for this team
			cursor, err := config.ProjectsCollection.Find(ctx, bson.M{
				"_id": bson.M{"$in": projectIDs},
			})
			
			if err == nil {
				defer cursor.Close(ctx)
				
				// Create a response structure with projects as full objects
				type TeamResponse struct {
					models.Team
					ProjectObjects []models.Project `json:"projectObjects"`
				}
				
				var projects []models.Project
				if err := cursor.All(ctx, &projects); err == nil {
					response := TeamResponse{
						Team:          team,
						ProjectObjects: projects,
					}
					c.JSON(http.StatusOK, response)
					return
				}
			}
		}
	}

	// If we couldn't populate projects or there are no projects, return the team as is
	c.JSON(http.StatusOK, team)
}

// createTeam creates a new team
func createTeam(c *gin.Context) {
	var input models.TeamCreateInput
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

	// Create team
	team := models.Team{
		ID:          primitive.NewObjectID(),
		Name:        input.Name,
		Description: input.Description,
		Owner:       userID,
		Members:     []models.Member{},
		Projects:    []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Insert team into database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.TeamsCollection.InsertOne(ctx, team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to create team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create team"})
		return
	}

	// Add team to user's teams
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$addToSet": bson.M{"teams": team.ID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Log error but continue - we still created the team
	}

	c.JSON(http.StatusCreated, team)
}

// updateTeam updates a team if the user is the owner
func updateTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input models.TeamUpdateInput
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

	// Convert team ID to ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user is the team owner
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"owner": userID,
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner can update team"})
		return
	}

	// Update team
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}
	if input.Description != "" {
		update["$set"].(bson.M)["description"] = input.Description
	}

	_, err = config.TeamsCollection.UpdateOne(ctx, bson.M{"_id": teamObjID}, update)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update team"})
		return
	}

	// Return updated team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// deleteTeam deletes a team if the user is the owner
func deleteTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert team ID to ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user is the team owner
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"owner": userID,
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner can delete team"})
		return
	}

	// Remove team from all users' teams arrays
	_, err = config.UsersCollection.UpdateMany(
		ctx,
		bson.M{"teams": teamObjID},
		bson.M{"$pull": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update users' teams: %w", err))
		// Log error but continue with deletion
	}

	// Delete team
	_, err = config.TeamsCollection.DeleteOne(ctx, bson.M{"_id": teamObjID})
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to delete team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete team"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team deleted successfully"})
}

// getTeamMembers returns all members of a team
func getTeamMembers(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Convert team ID to ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find team by ID
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "Team not found"})
		return
	}

	c.JSON(http.StatusOK, team.Members)
}

// addTeamMember adds a user to a team
func addTeamMember(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input struct {
		UserID string `json:"userId" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if input.Role != "editor" && input.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role must be either 'editor' or 'viewer'"})
		return
	}

	// Get user ID from context
	currentUserID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert IDs to ObjectIDs
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	userObjID, err := primitive.ObjectIDFromHex(input.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user is the team owner or an editor
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": currentUserID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": currentUserID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can add members"})
		return
	}
	
	// Check if user is already a member of the team
	if team.Owner == userObjID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User is already the team owner"})
		return
	}
	
	for _, member := range team.Members {
		if member.UserID == userObjID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User is already a member of the team"})
			return
		}
	}

	// Check if the user to add exists
	var userToAdd models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&userToAdd)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Add member to team
	member := models.Member{
		UserID: userObjID,
		Role:   input.Role,
		Name:   userToAdd.Name,
		Email:  userToAdd.Email,
	}

	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$addToSet": bson.M{"members": member},
			"$set":      bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to add member to team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member to team"})
		return
	}

	// Add team to user's teams list
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userObjID},
		bson.M{"$addToSet": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Log error but continue - we still added the member to the team
	}

	// Return updated team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// removeTeamMember removes a user from a team
func removeTeamMember(c *gin.Context) {
	teamID := c.Param("id")
	userIDToRemove := c.Param("userId")
	if teamID == "" || userIDToRemove == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID and User ID are required"})
		return
	}

	// Get current user ID from context
	currentUserID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert IDs to ObjectIDs
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	userObjIDToRemove, err := primitive.ObjectIDFromHex(userIDToRemove)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user is the team owner or an editor
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": currentUserID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": currentUserID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can remove members"})
		return
	}

	// Cannot remove the owner
	if team.Owner == userObjIDToRemove {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot remove the team owner"})
		return
	}

	// Remove member from team
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$pull": bson.M{"members": bson.M{"userId": userObjIDToRemove}},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to remove member from team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member from team"})
		return
	}

	// Remove team from user's teams list
	_, err = config.UsersCollection.UpdateOne(
		ctx,
		bson.M{"_id": userObjIDToRemove},
		bson.M{"$pull": bson.M{"teams": teamObjID}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update user teams: %w", err))
		// Log error but continue - we still removed the member from the team
	}

	// Return updated team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// getTeamProjects returns all projects of a team
func getTeamProjects(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	// Convert team ID to ObjectID
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find team projects
	cursor, err := config.ProjectsCollection.Find(ctx, bson.M{"teamId": teamObjID})
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get team projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get team projects"})
		return
	}
	defer cursor.Close(ctx)

	// Decode projects
	var projects []models.Project
	if err := cursor.All(ctx, &projects); err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to decode projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	c.JSON(http.StatusOK, projects)
}

// addProjectToTeam adds a project to a team
func addProjectToTeam(c *gin.Context) {
	teamID := c.Param("id")
	if teamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
		return
	}

	var input struct {
		ProjectID string `json:"projectId" binding:"required"`
	}
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

	// Convert IDs to ObjectIDs
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(input.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user has access to the team
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": userID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can add projects"})
		return
	}

	// Check if project exists and user has access to it
	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{
		"_id": projectObjID,
		"owner": userID,
	}).Decode(&project)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found or you don't have permission"})
		return
	}

	// Add project to team
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$addToSet": bson.M{"projects": input.ProjectID},
			"$set":      bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to add project to team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add project to team"})
		return
	}

	// Update project to belong to team
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$set": bson.M{"teamId": teamObjID, "updatedAt": time.Now()}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update project: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Return updated team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// removeProjectFromTeam removes a project from a team
func removeProjectFromTeam(c *gin.Context) {
	teamID := c.Param("id")
	projectID := c.Param("projectId")
	if teamID == "" || projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID and Project ID are required"})
		return
	}

	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert IDs to ObjectIDs
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user has access to the team
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members": bson.M{"$elemMatch": bson.M{"userId": userID, "role": "editor"}}},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only team owner or editors can remove projects"})
		return
	}

	// Remove project from team
	_, err = config.TeamsCollection.UpdateOne(
		ctx,
		bson.M{"_id": teamObjID},
		bson.M{
			"$pull": bson.M{"projects": projectID},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to remove project from team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove project from team"})
		return
	}

	// Update project to no longer belong to team
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{"$unset": bson.M{"teamId": ""}, "$set": bson.M{"updatedAt": time.Now()}},
	)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to update project: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	// Return updated team
	err = config.TeamsCollection.FindOne(ctx, bson.M{"_id": teamObjID}).Decode(&team)
	if err != nil {
		config.LogError("TEAMS", fmt.Errorf("failed to get updated team: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated team"})
		return
	}

	c.JSON(http.StatusOK, team)
}

// getTeamProjectViewer returns the viewer for a team project
func getTeamProjectViewer(c *gin.Context) {
	teamID := c.Param("id")
	projectID := c.Param("projectId")
	
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	
	// Convert IDs to ObjectIDs
	teamObjID, err := primitive.ObjectIDFromHex(teamID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if user has access to the team
	var team models.Team
	err = config.TeamsCollection.FindOne(ctx, bson.M{
		"_id": teamObjID,
		"$or": []bson.M{
			{"owner": userID},
			{"members.userId": userID},
		},
	}).Decode(&team)

	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Team not found or you don't have access to it"})
		return
	}
	
	// Check if project exists in this team's projects list
	projectFound := false
	for _, p := range team.Projects {
		if p == projectID {
			projectFound = true
			break
		}
	}
	
	if !projectFound {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found in the team"})
		return
	}
	
	// Use a raw bson.M to retrieve the project first
	var rawProject bson.M
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&rawProject)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	
	// Convert to a Project struct, but handle elements separately
	var project models.Project
	
	// Remove elements from raw data to avoid unmarshaling errors
	elementsRaw, hasElements := rawProject["elements"]
	delete(rawProject, "elements")
	
	// Convert the remaining fields to Project struct
	projectBytes, err := bson.Marshal(rawProject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	if err := bson.Unmarshal(projectBytes, &project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	// Handle elements separately - store as raw interface{}
	if hasElements {
		project.Elements = []interface{}{}
		
		// Check if elements is an array
		if elemArray, ok := elementsRaw.(primitive.A); ok {
			for _, elem := range elemArray {
				project.Elements = append(project.Elements, elem)
			}
		} else {
			// If not an array, add as a single element
			project.Elements = append(project.Elements, elementsRaw)
		}
	}

	// Normalize elements to ensure they have all required fields
	project.NormalizeElements()
	
	// Return the project directly, just like getProject does
	c.JSON(http.StatusOK, project)
} 