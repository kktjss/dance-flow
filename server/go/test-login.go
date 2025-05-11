package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	// Get MongoDB URI from environment or use default
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/dance-platform"
	}

	fmt.Printf("Testing MongoDB connection to: %s\n", mongoURI)

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Ping database
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	fmt.Println("Successfully connected to MongoDB!")

	// Test query on users collection
	db := client.Database("dance-platform")
	usersCollection := db.Collection("users")

	// Count users
	count, err := usersCollection.CountDocuments(ctx, bson.M{})
	if err != nil {
		log.Fatalf("Error counting users: %v", err)
	}
	fmt.Printf("Total users in database: %d\n", count)

	// List all users
	fmt.Println("Listing all users:")
	cursor, err := usersCollection.Find(ctx, bson.M{})
	if err != nil {
		log.Fatalf("Error finding users: %v", err)
	}
	defer cursor.Close(ctx)

	type User struct {
		ID       string `bson:"_id"`
		Username string `bson:"username"`
		Email    string `bson:"email"`
	}

	for cursor.Next(ctx) {
		var user User
		if err := cursor.Decode(&user); err != nil {
			log.Printf("Error decoding user: %v", err)
			continue
		}
		fmt.Printf("- ID: %s, Username: %s, Email: %s\n", user.ID, user.Username, user.Email)
	}

	if err := cursor.Err(); err != nil {
		log.Printf("Cursor error: %v", err)
	}

	fmt.Println("\nTest completed successfully!")
} 