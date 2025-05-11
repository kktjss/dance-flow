package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Connect to MongoDB
	mongoURI := "mongodb://localhost:27017/dance-platform"
	if os.Getenv("MONGODB_URI") != "" {
		mongoURI = os.Getenv("MONGODB_URI")
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	
	// Use the "dance-platform" database
	db := client.Database("dance-platform")
	users := db.Collection("users")
	
	// Find user by username
	username := "test"
	var user bson.M
	
	err = users.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		log.Fatalf("User not found: %v", err)
	}
	
	// Print the full user document without modifications
	fmt.Println("===== FULL USER DOCUMENT =====")
	userJSON, _ := json.MarshalIndent(user, "", "  ")
	fmt.Println(string(userJSON))
	
	// Check the password format
	password, ok := user["password"].(string)
	if !ok {
		fmt.Println("Password field is not a string or doesn't exist")
	} else {
		fmt.Printf("Password hash: %s\n", password)
		fmt.Printf("Password hash length: %d\n", len(password))
		
		// Test password verification
		testPassword := "test"
		err = bcrypt.CompareHashAndPassword([]byte(password), []byte(testPassword))
		if err != nil {
			fmt.Printf("Password verification failed: %v\n", err)
		} else {
			fmt.Printf("Password verification succeeded for '%s'\n", testPassword)
		}
	}
	
	// Check if username field exists
	_, hasUsername := user["username"]
	fmt.Printf("Has username field: %v\n", hasUsername)
	
	// Check if email field exists
	_, hasEmail := user["email"]
	fmt.Printf("Has email field: %v\n", hasEmail)

	// Print document structure
	fmt.Println("\n===== DOCUMENT STRUCTURE =====")
	for key, value := range user {
		switch v := value.(type) {
		case string:
			fmt.Printf("%s: string(%d chars)\n", key, len(v))
		case int, int32, int64:
			fmt.Printf("%s: number\n", key)
		case bool:
			fmt.Printf("%s: boolean\n", key)
		case []interface{}:
			fmt.Printf("%s: array(%d elements)\n", key, len(v))
		case map[string]interface{}:
			fmt.Printf("%s: object\n", key)
		default:
			fmt.Printf("%s: %T\n", key, v)
		}
	}
} 