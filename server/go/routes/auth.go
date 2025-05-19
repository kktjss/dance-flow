package routes

import (
	"context"
	"fmt"
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

// RegisterAuthRoutes регистрирует все маршруты аутентификации
func RegisterAuthRoutes(router *gin.RouterGroup, cfg *config.Config) {
	auth := router.Group("/auth")
	{
		auth.POST("/register", register(cfg))
		auth.POST("/login", login(cfg))
		
		// Добавляем тестовый эндпоинт для проверки доступности маршрутов аутентификации
		auth.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "Auth routes are working"})
		})
		
		// Тестовый эндпоинт для хеширования пароля
		auth.GET("/test-password", func(c *gin.Context) {
			password := c.Query("password")
			if password == "" {
				password = "test123"
			}
			
			// Создаем тестового пользователя с паролем
			user := models.User{
				Password: password,
			}
			
			// Хешируем пароль
			err := user.HashPassword()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
				return
			}
			
			// Проверяем соответствие пароля
			match := user.ComparePassword(password)
			
			c.JSON(http.StatusOK, gin.H{
				"original": password,
				"hashed": user.Password,
				"matches": match,
			})
		})
	}
}

// register обрабатывает регистрацию пользователя
func register(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Println("Registration attempt received")
		
		var input struct {
			Username  string `json:"username" binding:"required"`
			Name     string `json:"name"`
			Email    string `json:"email" binding:"required,email"`
			Password string `json:"password" binding:"required,min=6"`
		}

		if err := c.ShouldBindJSON(&input); err != nil {
			log.Printf("Registration error - Invalid request body: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("Registration attempt for username: %s, email: %s", input.Username, input.Email)

		// Если имя не указано, используем имя пользователя
		if input.Name == "" {
			input.Name = input.Username
		}

		// Проверяем, существуют ли уже email или имя пользователя
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var existingUser models.User
		err := config.UsersCollection.FindOne(ctx, bson.M{"$or": []bson.M{{"email": input.Email}, {"username": input.Username}}}).Decode(&existingUser)
		if err == nil {
			log.Printf("Registration failed: Email or username already in use - %s, %s", input.Email, input.Username)
			c.JSON(http.StatusConflict, gin.H{"error": "Email or username already in use"})
			return
		}

		// Создаем нового пользователя
		user := models.User{
			ID:        primitive.NewObjectID(),
			Username:  input.Username,
			Name:      input.Name,
			Email:     input.Email,
			Password:  input.Password,
			Role:      "user", // Роль по умолчанию
			Teams:     []primitive.ObjectID{},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Хешируем пароль
		if err := user.HashPassword(); err != nil {
			log.Printf("Registration failed: Failed to hash password - %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}

		// Вставляем пользователя в базу данных
		_, err = config.UsersCollection.InsertOne(ctx, user)
		if err != nil {
			log.Printf("Registration failed: Failed to create user - %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
			return
		}

		log.Printf("User created successfully: %s (%s)", user.Username, user.ID.Hex())

		// Генерируем JWT токен
		token, err := middleware.GenerateToken(user.ID, cfg)
		if err != nil {
			log.Printf("Failed to generate token: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}
		
		log.Printf("Token generated successfully for user: %s", user.Username)
		
		// Возвращаем пользователя и токен
		c.JSON(http.StatusCreated, gin.H{
			"user":  user.ToResponse(),
			"token": token,
		})
		
		// Создаем демонстрационные проекты для нового пользователя (после отправки ответа клиенту)
		go createPreviewProjects(context.Background(), user.ID)
		
		log.Printf("Registration successful for user: %s", user.Username)
	}
}

// login обрабатывает вход пользователя
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

		// Ищем пользователя по имени пользователя
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Проверяем соединение с MongoDB
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

		// Проверяем пароль
		log.Printf("Comparing provided password with stored hash")
		log.Printf("Password from request: '%s'", input.Password)
		log.Printf("Password hash from database: '%s'", user.Password)
		
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

// createPreviewProjects creates references to example projects for a new user
func createPreviewProjects(ctx context.Context, userID primitive.ObjectID) {
	log.Printf("Creating preview projects for user: %s", userID.Hex())
	
	// Use fixed IDs for preview projects - must be valid 24-character hex strings
	preview1ID, err1 := primitive.ObjectIDFromHex("507f1f77bcf86cd799439011")
	if err1 != nil {
		log.Printf("Error creating preview1ID: %v", err1)
		preview1ID = primitive.NewObjectID()
	}
	
	preview2ID, err2 := primitive.ObjectIDFromHex("507f1f77bcf86cd799439022")
	if err2 != nil {
		log.Printf("Error creating preview2ID: %v", err2)
		preview2ID = primitive.NewObjectID()
	}

	// Check if preview projects already exist
	var previewProject1 models.Project
	err1 = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": preview1ID}).Decode(&previewProject1)
	
	var previewProject2 models.Project
	err2 = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": preview2ID}).Decode(&previewProject2)

	// Create preview projects if they don't exist
	if err1 != nil {
		log.Printf("Preview project 1 not found, creating new one with ID: %s", preview1ID.Hex())
		
		// Preview project 1: Basic Dance Routine
		previewProject1 = models.Project{
			ID:          preview1ID,
			Name:        "Базовая танцевальная рутина",
			Description: "Пример простой танцевальной рутины с базовыми движениями",
			Owner:       userID, // First user becomes the owner
			Tags:        []string{"пример", "начинающий", "базовый"},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsPrivate:   false,
			Title:       "Мой первый танец",
			Duration:    60,
			Elements: []interface{}{
				map[string]interface{}{
					"id":       "element-1",
					"type":     "text",
					"content":  "Базовый шаг",
					"position": map[string]float64{"x": 100, "y": 100},
					"size":     map[string]float64{"width": 200, "height": 50},
				},
				map[string]interface{}{
					"id":       "element-2",
					"type":     "text",
					"content":  "Поворот",
					"position": map[string]float64{"x": 100, "y": 200},
					"size":     map[string]float64{"width": 200, "height": 50},
				},
			},
		}

		// Insert project into database
		_, insertErr := config.ProjectsCollection.InsertOne(ctx, previewProject1)
		if insertErr != nil {
			log.Printf("Failed to create preview project 1: %v", insertErr)
		} else {
			log.Printf("Created preview project 1 with ID: %s", preview1ID.Hex())
		}
	} else {
		log.Printf("Preview project 1 already exists with ID: %s", preview1ID.Hex())
	}

	if err2 != nil {
		log.Printf("Preview project 2 not found, creating new one with ID: %s", preview2ID.Hex())
		
		// Preview project 2: Advanced Choreography
		previewProject2 = models.Project{
			ID:          preview2ID,
			Name:        "Продвинутая хореография",
			Description: "Пример сложной хореографии с комбинацией движений",
			Owner:       userID, // First user becomes the owner
			Tags:        []string{"пример", "продвинутый", "хореография"},
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			IsPrivate:   false,
			Title:       "Моя хореография",
			Duration:    120,
			Elements: []interface{}{
				map[string]interface{}{
					"id":       "element-1",
					"type":     "text",
					"content":  "Вступление",
					"position": map[string]float64{"x": 50, "y": 50},
					"size":     map[string]float64{"width": 200, "height": 50},
				},
				map[string]interface{}{
					"id":       "element-2",
					"type":     "text",
					"content":  "Основная часть",
					"position": map[string]float64{"x": 50, "y": 150},
					"size":     map[string]float64{"width": 200, "height": 50},
				},
				map[string]interface{}{
					"id":       "element-3",
					"type":     "text",
					"content":  "Финал",
					"position": map[string]float64{"x": 50, "y": 250},
					"size":     map[string]float64{"width": 200, "height": 50},
				},
			},
		}

		// Insert project into database
		_, insertErr := config.ProjectsCollection.InsertOne(ctx, previewProject2)
		if insertErr != nil {
			log.Printf("Failed to create preview project 2: %v", insertErr)
		} else {
			log.Printf("Created preview project 2 with ID: %s", preview2ID.Hex())
		}
	} else {
		log.Printf("Preview project 2 already exists with ID: %s", preview2ID.Hex())
	}

	// Create history entries for project access
	historyEntry1 := models.CreateHistory(
		userID,
		preview1ID,
		models.ActionProjectCreated,
		fmt.Sprintf("Получен доступ к проекту '%s'", previewProject1.Name),
	)
	
	historyEntry2 := models.CreateHistory(
		userID,
		preview2ID,
		models.ActionProjectCreated,
		fmt.Sprintf("Получен доступ к проекту '%s'", previewProject2.Name),
	)
	
	historyCollection := config.GetCollection("histories")
	_, err := historyCollection.InsertOne(ctx, historyEntry1)
	if err != nil {
		log.Printf("Failed to create history entry for preview project 1: %v", err)
	} else {
		log.Printf("Created history entry for preview project 1")
	}
	
	_, err = historyCollection.InsertOne(ctx, historyEntry2)
	if err != nil {
		log.Printf("Failed to create history entry for preview project 2: %v", err)
	} else {
		log.Printf("Created history entry for preview project 2")
	}
	
	log.Printf("Finished creating preview projects for user: %s", userID.Hex())
} 