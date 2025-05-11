package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port           int
	MongoURI       string
	JWTSecret      string
	JWTExpiration  string
	AllowedOrigins []string
}

// Load returns the configuration
func Load() *Config {
	// Load env file if it exists
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables")
	} else {
		log.Println("Loaded environment variables from .env file")
	}

	// Set default port if not provided
	port := 5000
	if os.Getenv("PORT") != "" {
		portValue, err := strconv.Atoi(os.Getenv("PORT"))
		if err == nil {
			port = portValue
		}
	}
	log.Printf("Server port: %d", port)

	// Set MongoDB URI
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/dance-platform"
		log.Println("Warning: MONGODB_URI not set, using default: mongodb://localhost:27017/dance-platform")
	} else {
		log.Printf("Using MongoDB URI: %s", mongoURI)
	}

	// Set JWT secret
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "default-secret-key-change-in-production"
		log.Println("Warning: JWT_SECRET not set, using default secret (unsafe for production)")
	} else {
		log.Println("JWT_SECRET loaded from environment")
	}

	// Set JWT expiration
	jwtExpiration := os.Getenv("JWT_EXPIRATION")
	if jwtExpiration == "" {
		jwtExpiration = "24h"
		log.Println("Using default JWT expiration: 24h")
	} else {
		log.Printf("JWT expiration: %s", jwtExpiration)
	}

	// Set allowed origins for CORS
	allowedOrigins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	log.Printf("Allowed CORS origins: %v", allowedOrigins)

	config := &Config{
		Port:           port,
		MongoURI:       mongoURI,
		JWTSecret:      jwtSecret,
		JWTExpiration:  jwtExpiration,
		AllowedOrigins: allowedOrigins,
	}
	
	log.Printf("Configuration loaded successfully")
	return config
} 