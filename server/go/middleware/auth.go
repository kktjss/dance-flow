package middleware

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JWTMiddleware verifies the JWT token and sets user ID in context
func JWTMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Check if the header has the format "Bearer {token}"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		// Extract token
		tokenString := parts[1]
		claims := jwt.MapClaims{}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		if !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Check token expiration
		exp, ok := claims["exp"].(float64)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			c.Abort()
			return
		}

		if int64(exp) < time.Now().Unix() {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token expired"})
			c.Abort()
			return
		}

		// Extract user ID
		userID, ok := claims["id"].(string)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Set user ID in context for later use
		c.Set("userID", userID)
		c.Next()
	}
}

// AuthMiddleware - псевдоним для JWTMiddleware для обратной совместимости
var AuthMiddleware = JWTMiddleware

// GetUserID extracts the user ID from the context
func GetUserID(c *gin.Context) (primitive.ObjectID, error) {
	userIDStr, exists := c.Get("userID")
	if !exists {
		return primitive.ObjectID{}, errors.New("user ID not found in context")
	}

	userID, err := primitive.ObjectIDFromHex(userIDStr.(string))
	if err != nil {
		return primitive.ObjectID{}, errors.New("invalid user ID format")
	}

	return userID, nil
}

// GenerateToken generates a JWT token for a user
func GenerateToken(userID primitive.ObjectID, cfg *config.Config) (string, error) {
	// Parse expiration time
	expDuration, err := time.ParseDuration(cfg.JWTExpiration)
	if err != nil {
		log.Printf("Invalid JWT expiration duration: %v, using default 24h", err)
		expDuration = 24 * time.Hour // Default to 24 hours
	}

	// Check if JWT secret is set
	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT secret is empty!")
	}

	// Create token with user ID and username in claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       userID.Hex(),
		"exp":      time.Now().Add(expDuration).Unix(),
	})

	// Log token claims for debugging
	log.Printf("Creating token for user ID: %s with expiration: %v", 
		userID.Hex(), time.Now().Add(expDuration))

	// Sign token with secret
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		log.Printf("Token signing error: %v", err)
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return tokenString, nil
}

// CheckProjectIsPrivate checks if a project is private and verifies user access
func CheckProjectIsPrivate() gin.HandlerFunc {
	return func(c *gin.Context) {
		projectID := c.Param("id")
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

		// Get project
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var project models.Project
		err = config.GetCollection("projects").FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
			c.Abort()
			return
		}

		// Check if project is public or user has access
		if !project.IsPrivate {
			// Public project, allow access
			c.Next()
			return
		}

		// Private project, check if user is owner or team member
		if project.Owner == userID {
			// User is the owner
			c.Next()
			return
		}

		// Check if user is a member of the project's team
		if !project.TeamID.IsZero() {
			var team models.Team
			err = config.GetCollection("teams").FindOne(ctx, bson.M{
				"_id": project.TeamID,
				"members": bson.M{
					"$elemMatch": bson.M{
						"userId": userID,
					},
				},
			}).Decode(&team)

			if err == nil {
				// User is a team member
				c.Next()
				return
			}
		}

		// User doesn't have access
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have access to this project"})
		c.Abort()
	}
} 