package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/routes"
)

func main() {
	// Load configuration
	log.Println("Loading configuration...")
	cfg := config.Load()

	// Initialize logger
	log.Println("Initializing logger...")
	if err := config.InitLogger(); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer config.CloseLogger()

	// Connect to MongoDB
	log.Println("Connecting to MongoDB...")
	err := config.Connect(cfg.MongoURI)
	if err != nil {
		config.LogError("MAIN", fmt.Errorf("failed to connect to MongoDB: %w", err))
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	log.Println("Successfully connected to MongoDB!")
	defer config.Close()

	// Create router
	log.Println("Setting up HTTP router...")
	router := gin.Default()

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Add middleware for logging
	router.Use(func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Process request
		c.Next()

		// Log request to both console and file
		duration := time.Since(start)
		log.Printf("[%s] %s %s %d %s", 
			c.Request.Method, 
			c.Request.URL.Path, 
			c.ClientIP(), 
			c.Writer.Status(),
			duration.String())
			
		config.LogRequest(
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			c.Writer.Status(),
			duration,
		)
	})

	// Add a special handler for model files to ensure proper content type
	// This must come BEFORE the StaticFS to avoid conflicts with wildcard routes
	router.GET("/models/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filepath := fmt.Sprintf("./uploads/models/%s", filename)
		
		// Log the request
		log.Printf("Serving model file: %s", filepath)
		
		// Check if file exists
		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			log.Printf("Model file not found: %s", filepath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Model file not found"})
			return
		}
		
		// Set appropriate headers
		c.Header("Content-Type", "model/gltf-binary")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Serve the file
		c.File(filepath)
	})
	
	// Serve static files from uploads directory with proper headers
	router.StaticFS("/uploads", http.Dir("./uploads"))
	
	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// Create API group
	api := router.Group("/api")

	// Register routes
	log.Println("Registering API routes...")
	routes.RegisterAuthRoutes(api, cfg)
	routes.RegisterProjectRoutes(api, cfg)
	routes.RegisterKeyframesRoutes(api, cfg)
	routes.RegisterUploadRoutes(api, cfg)
	
	// Register new routes
	routes.RegisterHistoryRoutes(api, cfg)
	routes.RegisterDirectKeyframesRoutes(api, cfg)
	routes.RegisterTestRoutes(api, cfg)
	routes.RegisterTeamRoutes(api, cfg)
	routes.RegisterUserRoutes(api, cfg)
	routes.RegisterModelRoutes(api, cfg)
	
	log.Println("All routes registered successfully!")

	// Create a channel to listen for interrupt signals
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	// Run server in a goroutine
	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		config.Log("MAIN", "Server starting on %s", addr)
		log.Printf("Server starting on %s", addr)
		if err := router.Run(addr); err != nil && err != http.ErrServerClosed {
			config.LogError("MAIN", fmt.Errorf("failed to start server: %w", err))
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-stop
	config.Log("MAIN", "Shutting down server...")
	log.Println("Shutting down server...")

	// Implement graceful shutdown here if needed
	config.Log("MAIN", "Server stopped")
	log.Println("Server stopped")
} 