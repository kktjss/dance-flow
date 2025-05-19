package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/kktjss/dance-flow/config"
	"go.mongodb.org/mongo-driver/bson"
)

func main() {
	// Загрузка конфигурации
	log.Println("Loading configuration...")
	cfg := config.Load()

	// Подключение к MongoDB
	log.Println("Connecting to MongoDB...")
	err := config.Connect(cfg.MongoURI)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer config.Close()

	// Создание контекста с таймаутом
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Определение фильтра для тестовых проектов
	filter := bson.M{
		"name":        "Test Project",
		"description": "Created for API testing",
	}

	// Удаление тестовых проектов
	result, err := config.ProjectsCollection.DeleteMany(ctx, filter)
	if err != nil {
		log.Fatalf("Failed to delete test projects: %v", err)
	}

	log.Printf("Successfully deleted %d test projects", result.DeletedCount)
	fmt.Printf("Deleted %d test projects\n", result.DeletedCount)
} 