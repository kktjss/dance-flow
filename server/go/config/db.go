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

// Экземпляр базы данных
var DB *mongo.Database

// Коллекции
var (
	UsersCollection      *mongo.Collection
	ProjectsCollection   *mongo.Collection
	TeamsCollection      *mongo.Collection
	KeyframesCollection  *mongo.Collection
	HistoryCollection    *mongo.Collection
)

// Connect устанавливает соединение с MongoDB
func Connect(mongoURI string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Подключение к MongoDB
	clientOptions := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Printf("Не удалось подключиться к MongoDB: %v", err)
		return fmt.Errorf("не удалось подключиться к MongoDB: %w", err)
	}

	// Пинг базы данных
	err = client.Ping(ctx, readpref.Primary())
	if err != nil {
		log.Printf("Не удалось выполнить пинг MongoDB: %v", err)
		return fmt.Errorf("не удалось выполнить пинг MongoDB: %w", err)
	}

	log.Println("Подключено к MongoDB")

	// Установка базы данных и коллекций
	DB = client.Database("dance-platform")
	UsersCollection = DB.Collection("users")
	ProjectsCollection = DB.Collection("projects")
	TeamsCollection = DB.Collection("teams")
	KeyframesCollection = DB.Collection("keyframes")
	HistoryCollection = DB.Collection("history")

	return nil
}

// Close закрывает соединение с MongoDB
func Close() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if DB != nil {
		if err := DB.Client().Disconnect(ctx); err != nil {
			log.Printf("Не удалось отключиться от MongoDB: %v", err)
		}
	}
}

// GetCollection возвращает коллекцию MongoDB по имени
func GetCollection(name string) *mongo.Collection {
	return DB.Collection(name)
} 