package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CheckProjectAccess checks if the user has access to the project
func CheckProjectAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
		if projectID == "" || projectID == "undefined" || projectID == "null" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
			c.Abort()
			return
		}

		// Get user ID from context
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Convert project ID to ObjectID
		projectObjID, err := primitive.ObjectIDFromHex(projectID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
			c.Abort()
			return
		}

		// Create context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// First check if user is the project owner (most common case)
		var projectCount int64
		projectCount, err = config.ProjectsCollection.CountDocuments(ctx, bson.M{
			"_id": projectObjID,
			"owner": userID,
		})
		
		if err == nil && projectCount > 0 {
			// User is the project owner, allow access
			c.Next()
			return
		}

		// If not the owner, then check if it's a team project and if user is in that team
		var project bson.M
		err = config.ProjectsCollection.FindOne(ctx, bson.M{
			"_id": projectObjID,
		}).Decode(&project)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			c.Abort()
			return
		}

		// If project has a team ID, check if user is a member of that team
		if teamIDValue, hasTeamID := project["teamId"]; hasTeamID && !teamIDValue.(primitive.ObjectID).IsZero() {
			teamID := teamIDValue.(primitive.ObjectID)
			
			// Check if user is a member of the team
			teamCount, teamErr := config.TeamsCollection.CountDocuments(ctx, bson.M{
				"_id": teamID,
				"$or": []bson.M{
					{"owner": userID},          // User is team owner
					{"members.userId": userID}, // User is team member
				},
			})
			
			if teamErr == nil && teamCount > 0 {
				// User is part of the team, allow access
				c.Next()
				return
			}
		}

		// If we get here, user doesn't have access
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this project"})
		c.Abort()
	}
}

// CheckTeamAccess checks if the user has access to the team
func CheckTeamAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		teamID := c.Param("id")
		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Team ID is required"})
			c.Abort()
			return
		}

		// Get user ID from context
		userID, err := GetUserID(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		// Convert team ID to ObjectID
		teamObjID, err := primitive.ObjectIDFromHex(teamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			c.Abort()
			return
		}

		// Create context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Check if team exists and user has access
		var result bson.M
		err = config.TeamsCollection.FindOne(ctx, bson.M{
			"_id": teamObjID,
			"$or": []bson.M{
				{"owner": userID},          // User is owner
				{"members.userId": userID}, // User is member
			},
		}).Decode(&result)

		if err != nil {
			// If team not found or user doesn't have access
			c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this team"})
			c.Abort()
			return
		}

		// Team access granted
		c.Next()
	}
} 