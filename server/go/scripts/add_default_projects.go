package main

import (
	"context"
	"log"
	"time"

	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
)

// DefaultProject represents a default project template
type DefaultProject struct {
	Name        string
	Description string
	DanceStyle  string
	Tags        []string
}

var defaultProjects = []DefaultProject{
	{
		Name:        "Базовые движения сальсы",
		Description: "Основные шаги и движения сальсы для начинающих",
		DanceStyle:  "salsa",
		Tags:        []string{"salsa", "beginner", "basics"},
	},
	{
		Name:        "Базовые движения бачаты",
		Description: "Основные шаги и движения бачаты для начинающих",
		DanceStyle:  "bachata",
		Tags:        []string{"bachata", "beginner", "basics"},
	},
}

func main() {
	// Load configuration
	log.Println("Loading configuration...")
	cfg := config.Load()

	// Connect to MongoDB
	log.Println("Connecting to MongoDB...")
	err := config.Connect(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer config.Close()

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Get all users
	log.Println("Fetching all users...")
	cursor, err := config.UsersCollection.Find(ctx, bson.M{})
	if err != nil {
		log.Fatalf("Failed to fetch users: %v", err)
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err = cursor.All(ctx, &users); err != nil {
		log.Fatalf("Failed to decode users: %v", err)
	}

	log.Printf("Found %d users", len(users))

	// For each user, check and create default projects if they don't exist
	for _, user := range users {
		log.Printf("Processing user: %s (%s)", user.Username, user.ID.Hex())

		// Check if user already has default projects
		for _, defaultProj := range defaultProjects {
			exists, err := projectExists(ctx, user.ID.Hex(), defaultProj.Name)
			if err != nil {
				log.Printf("Error checking project existence for user %s: %v", user.ID.Hex(), err)
				continue
			}

			if !exists {
				// Create default project
				project := &models.Project{
					Name:        defaultProj.Name,
					Description: defaultProj.Description,
					UserID:      user.ID.Hex(),
					DanceStyle:  defaultProj.DanceStyle,
					Tags:        defaultProj.Tags,
					IsPrivate:   false,
				}

				result, err := config.ProjectsCollection.InsertOne(ctx, project)
				if err != nil {
					log.Printf("Failed to create default project for user %s: %v", user.ID.Hex(), err)
					continue
				}

				log.Printf("Created default project '%s' for user %s (ID: %v)", defaultProj.Name, user.Username, result.InsertedID)
			} else {
				log.Printf("Default project '%s' already exists for user %s", defaultProj.Name, user.Username)
			}
		}
	}

	log.Println("Migration completed successfully!")
}

// projectExists checks if a project with the given name already exists for the user
func projectExists(ctx context.Context, userID, projectName string) (bool, error) {
	count, err := config.ProjectsCollection.CountDocuments(ctx, bson.M{
		"userId": userID,
		"name":   projectName,
	})
	if err != nil {
		return false, err
	}
	return count > 0, nil
} 