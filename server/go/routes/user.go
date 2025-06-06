package routes

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// RegisterUserRoutes registers all user routes
func RegisterUserRoutes(router *gin.RouterGroup, cfg *config.Config) {
	users := router.Group("/users")
	users.Use(middleware.JWTMiddleware(cfg))
	{
		users.GET("", getUsers)
		users.GET("/:id", getUserByID)
		users.PUT("/me", updateCurrentUser)
		users.GET("/me", getCurrentUser)
		users.DELETE("/me", deleteCurrentUser)
		
		// Add a test endpoint
		users.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "User routes are working"})
		})
	}
}

// getUsers searches for users, with optional filters
func getUsers(c *gin.Context) {
	// Get query parameters
	search := c.Query("search")
	teamID := c.Query("teamId")
	
	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Build the filter
	filter := bson.M{}
	
	// Add search filter if provided
	if search != "" {
		filter["$or"] = []bson.M{
			{"username": bson.M{"$regex": search, "$options": "i"}},
			{"name": bson.M{"$regex": search, "$options": "i"}},
			{"email": bson.M{"$regex": search, "$options": "i"}},
		}
	}
	
	// Add team filter if provided
	if teamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(teamID)
		if err == nil {
			filter["teams"] = teamObjID
		}
	}
	
	// Find options
	findOptions := options.Find().
		SetSort(bson.M{"username": 1}).
		SetLimit(50) // Limit to 50 results for safety
	
	// Execute query
	cursor, err := config.UsersCollection.Find(ctx, filter, findOptions)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get users: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}
	defer cursor.Close(ctx)

	// Decode users
	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		config.LogError("USERS", fmt.Errorf("failed to decode users: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode users"})
		return
	}
	
	// Convert to safe response objects
	var userResponses []models.UserResponse
	for _, user := range users {
		userResponses = append(userResponses, user.ToResponse())
	}

	c.JSON(http.StatusOK, userResponses)
}

// getUserByID returns a specific user by ID
func getUserByID(c *gin.Context) {
	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	// Convert user ID to ObjectID
	userObjID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find user by ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userObjID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Convert to safe response object
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// getCurrentUser returns the current authenticated user
func getCurrentUser(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find user by ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Convert to safe response object
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// updateCurrentUser updates the current authenticated user
func updateCurrentUser(c *gin.Context) {
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
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

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Find user by ID
	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get user: %w", err))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Update fields
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}

	if input.Email != "" {
		// Check if email is already in use
		var existingUser models.User
		err = config.UsersCollection.FindOne(ctx, bson.M{
			"_id":   bson.M{"$ne": userID},
			"email": input.Email,
		}).Decode(&existingUser)

		if err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
			return
		}

		update["$set"].(bson.M)["email"] = input.Email
	}

	if input.Password != "" {
		// Hash password using bcrypt directly
		hashedBytes, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			config.LogError("USERS", fmt.Errorf("failed to hash password: %w", err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		update["$set"].(bson.M)["password"] = string(hashedBytes)
	}

	// Update user
	_, err = config.UsersCollection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to update user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	// Get updated user
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to get updated user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated user"})
		return
	}

	// Convert to safe response object
	userResponse := user.ToResponse()
	c.JSON(http.StatusOK, userResponse)
}

// deleteCurrentUser deletes the current authenticated user and all associated data
func deleteCurrentUser(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 1. Remove user from all teams they are a member of
	_, err = config.TeamsCollection.UpdateMany(
		ctx,
		bson.M{"members.userId": userID},
		bson.M{"$pull": bson.M{"members": bson.M{"userId": userID}}},
	)
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to remove user from teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 2. Delete all user's models
	// First, get all user's models to delete files
	cursor, err := config.GetCollection("models").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to find user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	defer cursor.Close(ctx)

	var models []models.Model
	if err := cursor.All(ctx, &models); err != nil {
		config.LogError("USERS", fmt.Errorf("failed to decode user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// Delete model files
	for _, model := range models {
		filePath := filepath.Join("uploads/models", model.Filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			config.LogError("USERS", fmt.Errorf("failed to delete model file %s: %w", filePath, err))
			// Continue with deletion even if file removal fails
		}
	}

	// Delete model records
	_, err = config.GetCollection("models").DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's models: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 3. Delete all user's projects
	_, err = config.ProjectsCollection.DeleteMany(ctx, bson.M{"owner": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's projects: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 4. Delete user's history records
	_, err = config.GetCollection("history").DeleteMany(ctx, bson.M{"userId": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's history: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 5. Delete teams where user is the owner
	_, err = config.TeamsCollection.DeleteMany(ctx, bson.M{"owner": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user's teams: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// 6. Finally, delete the user
	_, err = config.UsersCollection.DeleteOne(ctx, bson.M{"_id": userID})
	if err != nil {
		config.LogError("USERS", fmt.Errorf("failed to delete user: %w", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
} 