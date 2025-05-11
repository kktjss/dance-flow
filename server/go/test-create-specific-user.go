package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// Define a simplified User struct for the script
type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Username  string             `bson:"username"`
	Name      string             `bson:"name"`
	Email     string             `bson:"email"`
	Password  string             `bson:"password"`
	Role      string             `bson:"role"`
	Teams     []interface{}      `bson:"teams"`
	CreatedAt time.Time          `bson:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt"`
}

// HashPassword - helper function to hash the password
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedPassword), nil
}

func main() {
	fmt.Println("Creating specific test user in MongoDB...")

	// Get MongoDB URI from environment or use default
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017/dance-platform"
	}

	fmt.Printf("Connecting to MongoDB: %s\n", mongoURI)

	// Connect to MongoDB directly (not using app's connection)
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

	// Set up the collections
	db := client.Database("dance-platform")
	usersCollection := db.Collection("users")

	// Define user based on existing db records
	username := "test"
	password := "test"
	email := "test@example.com"

	// Check if user already exists
	var existingUser User
	err = usersCollection.FindOne(ctx, bson.M{"username": username}).Decode(&existingUser)
	
	if err == nil {
		// If user exists, update password
		fmt.Printf("User '%s' already exists in the database. Updating password...\n", username)
		
		// Hash the new password
		hashedPassword, err := HashPassword(password)
		if err != nil {
			log.Fatalf("Failed to hash password: %v", err)
		}
		
		// Update the user's password
		_, err = usersCollection.UpdateOne(
			ctx,
			bson.M{"username": username},
			bson.M{"$set": bson.M{"password": hashedPassword}},
		)
		
		if err != nil {
			log.Fatalf("Failed to update user's password: %v", err)
		}
		
		fmt.Printf("Updated password for user '%s'\n", username)
		fmt.Printf("Username: %s\n", username)
		fmt.Printf("Password: %s (original, not hashed)\n", password)
		return
	}

	// Hash the password
	hashedPassword, err := HashPassword(password)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	// Create the user
	user := User{
		ID:        primitive.NewObjectID(),
		Username:  username,
		Name:      "Test User",
		Email:     email,
		Password:  hashedPassword,
		Role:      "user",
		Teams:     []interface{}{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Insert user into database
	result, err := usersCollection.InsertOne(ctx, user)
	if err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}

	fmt.Printf("Created test user with ID: %v\n", result.InsertedID)
	fmt.Printf("Username: %s\n", username)
	fmt.Printf("Email: %s\n", email)
	fmt.Printf("Password: %s (original, not hashed)\n", password)

	fmt.Println("\nYou can now use these credentials to log in.")
} 