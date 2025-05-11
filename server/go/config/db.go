package config

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

// Database instance
var DB *mongo.Database

// Collections
var (
	UsersCollection      *mongo.Collection
	ProjectsCollection   *mongo.Collection
	TeamsCollection      *mongo.Collection
	KeyframesCollection  *mongo.Collection
	HistoryCollection    *mongo.Collection
)

// Connect establishes connection to MongoDB
func Connect(mongoURI string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Connect to MongoDB
	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Printf("Failed to connect to MongoDB: %v", err)
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the database
	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		log.Printf("Failed to ping MongoDB: %v", err)
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("Connected to MongoDB")

	// Set database and collections
	DB = client.Database("dance-platform")
	UsersCollection = DB.Collection("users")
	ProjectsCollection = DB.Collection("projects")
	TeamsCollection = DB.Collection("teams")
	KeyframesCollection = DB.Collection("keyframes")
	HistoryCollection = DB.Collection("history")

	return nil
}

// Close closes the MongoDB connection
func Close() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if DB != nil {
		if err := DB.Client().Disconnect(ctx); err != nil {
			log.Printf("Failed to disconnect from MongoDB: %v", err)
		}
	}
}

// GetCollection returns a MongoDB collection by name
func GetCollection(name string) *mongo.Collection {
	return DB.Collection(name)
} 