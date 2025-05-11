package routes

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RegisterAuthRoutes registers all authentication routes
func RegisterAuthRoutes(router *gin.RouterGroup, cfg *config.Config) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", register)
		auth.POST("/login", login(cfg))
		
		// Add a test endpoint to verify auth routes are accessible
		auth.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Auth routes are working"})
		})
	}
}

// register handles user registration
func register(c *gin.Context) {
	var input struct {
		Username  string `json:"username" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if email or username already exists
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var existingUser models.User
	err := config.UsersCollection.FindOne(ctx, bson.M{"$or": []bson.M{{"email": input.Email}, {"username": input.Username}}}).Decode(&existingUser)
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email or username already in use"})
		return
	}

	// Create new user
	user := models.User{
		ID:        primitive.NewObjectID(),
		Username:  input.Username,
		Name:      input.Name,
		Email:     input.Email,
		Password:  input.Password,
		Role:      "user", // Default role
		Teams:     []primitive.ObjectID{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Hash password
	if err := user.HashPassword(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Insert user into database
	_, err = config.UsersCollection.InsertOne(ctx, user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Return user without password
	c.JSON(http.StatusCreated, user.ToResponse())
}

// login handles user login
func login(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Println("Login attempt received")
		
		var input struct {
			Username string `json:"username" binding:"required"`
			Password string `json:"password" binding:"required"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			log.Printf("Login error - Invalid request body: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		
		log.Printf("Login attempt for username: %s, password: %s", input.Username, input.Password)

		// Find user by username
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Verify MongoDB connection
		if config.DB == nil {
			log.Println("ERROR: MongoDB connection is nil")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not established"})
			return
		}
		
		if config.UsersCollection == nil {
			log.Println("ERROR: Users collection is nil")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Users collection not available"})
			return
		}

		var user models.User
		filter := bson.M{"username": input.Username}
		log.Printf("Searching for user with filter: %v", filter)
		
		err := config.UsersCollection.FindOne(ctx, filter).Decode(&user)
		if err != nil {
			log.Printf("User not found: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
			return
		}
		
		log.Printf("User found: ID=%s, Username=%s, Password hash=%s", 
			user.ID.Hex(), user.Username, user.Password)

		// Для отладки - просто выведем хэш пароля и посмотрим, как работает bcrypt
		testPassword := "test"
		log.Printf("Testing bcrypt compare: raw password='%s', hash='%s'", 
			testPassword, user.Password)
		
		// Verify password
		if !user.ComparePassword(input.Password) {
			log.Println("Password verification failed")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
			return
		}
		
		log.Println("Password verified successfully")

		// Generate JWT token
		token, err := middleware.GenerateToken(user.ID, cfg)
		if err != nil {
			log.Printf("Failed to generate token: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}
		
		log.Println("Token generated successfully")

		// Return user and token
		c.JSON(http.StatusOK, gin.H{
			"user":  user.ToResponse(),
			"token": token,
		})
		
		log.Println("Login successful")
	}
} 