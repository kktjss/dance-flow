package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	// Импортируем модели из проекта
	"dance-flow/server/go/models"
)

var (
	testClient *mongo.Client
	testDB     *mongo.Database
)

// Настройка тестовой базы данных перед запуском тестов
func setupTestDB() (*mongo.Client, *mongo.Database, error) {
	// Используем тестовую базу данных
	mongoURI := os.Getenv("MONGO_TEST_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	
	// Подключаемся к MongoDB
	clientOptions := options.Client().ApplyURI(mongoURI)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, nil, err
	}
	
	// Проверяем соединение
	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	
	// Используем тестовую базу данных
	db := client.Database("dance_flow_test")
	
	return client, db, nil
}

// Очистка тестовой базы данных после тестов
func cleanupTestDB(client *mongo.Client, db *mongo.Database) error {
	// Удаляем все коллекции
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	err := db.Drop(ctx)
	if err != nil {
		return err
	}
	
	return client.Disconnect(ctx)
}

func TestMain(m *testing.M) {
	// Настраиваем тестовую базу данных
	var err error
	testClient, testDB, err = setupTestDB()
	if err != nil {
		panic(err)
	}
	
	// Запускаем тесты
	code := m.Run()
	
	// Очищаем тестовую базу данных
	err = cleanupTestDB(testClient, testDB)
	if err != nil {
		panic(err)
	}
	
	os.Exit(code)
}

// Тест создания и получения пользователя
func TestUserCRUD(t *testing.T) {
	// Создаем коллекцию пользователей
	usersCollection := testDB.Collection("users")
	
	// Создаем тестового пользователя
	testUser := models.User{
		Username:  "testuser",
		Email:     "test@example.com",
		Password:  "hashedpassword", // В реальности должен быть хеш
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	// Вставляем пользователя в базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	result, err := usersCollection.InsertOne(ctx, testUser)
	require.NoError(t, err)
	require.NotNil(t, result.InsertedID)
	
	// Получаем ID вставленного пользователя
	insertedID := result.InsertedID.(primitive.ObjectID)
	
	// Получаем пользователя из базы данных
	var retrievedUser models.User
	err = usersCollection.FindOne(ctx, bson.M{"_id": insertedID}).Decode(&retrievedUser)
	require.NoError(t, err)
	
	// Проверяем, что данные пользователя совпадают
	assert.Equal(t, testUser.Username, retrievedUser.Username)
	assert.Equal(t, testUser.Email, retrievedUser.Email)
	
	// Обновляем пользователя
	update := bson.M{
		"$set": bson.M{
			"username":  "updateduser",
			"updatedAt": time.Now(),
		},
	}
	
	_, err = usersCollection.UpdateOne(ctx, bson.M{"_id": insertedID}, update)
	require.NoError(t, err)
	
	// Получаем обновленного пользователя
	var updatedUser models.User
	err = usersCollection.FindOne(ctx, bson.M{"_id": insertedID}).Decode(&updatedUser)
	require.NoError(t, err)
	
	// Проверяем, что данные пользователя обновились
	assert.Equal(t, "updateduser", updatedUser.Username)
	assert.Equal(t, testUser.Email, updatedUser.Email)
	
	// Удаляем пользователя
	_, err = usersCollection.DeleteOne(ctx, bson.M{"_id": insertedID})
	require.NoError(t, err)
	
	// Проверяем, что пользователь удален
	count, err := usersCollection.CountDocuments(ctx, bson.M{"_id": insertedID})
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

// Тест создания и получения проекта
func TestProjectCRUD(t *testing.T) {
	// Создаем коллекцию проектов
	projectsCollection := testDB.Collection("projects")
	
	// Создаем тестовый проект
	userID := primitive.NewObjectID()
	testProject := models.Project{
		Name:        "Test Project",
		Description: "This is a test project",
		UserID:      userID,
		IsPrivate:   false,
		Tags:        []string{"test", "integration"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	
	// Вставляем проект в базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	result, err := projectsCollection.InsertOne(ctx, testProject)
	require.NoError(t, err)
	require.NotNil(t, result.InsertedID)
	
	// Получаем ID вставленного проекта
	insertedID := result.InsertedID.(primitive.ObjectID)
	
	// Получаем проект из базы данных
	var retrievedProject models.Project
	err = projectsCollection.FindOne(ctx, bson.M{"_id": insertedID}).Decode(&retrievedProject)
	require.NoError(t, err)
	
	// Проверяем, что данные проекта совпадают
	assert.Equal(t, testProject.Name, retrievedProject.Name)
	assert.Equal(t, testProject.Description, retrievedProject.Description)
	assert.Equal(t, testProject.UserID, retrievedProject.UserID)
	assert.Equal(t, testProject.IsPrivate, retrievedProject.IsPrivate)
	assert.ElementsMatch(t, testProject.Tags, retrievedProject.Tags)
	
	// Обновляем проект
	update := bson.M{
		"$set": bson.M{
			"name":        "Updated Project",
			"description": "This project has been updated",
			"updatedAt":   time.Now(),
		},
	}
	
	_, err = projectsCollection.UpdateOne(ctx, bson.M{"_id": insertedID}, update)
	require.NoError(t, err)
	
	// Получаем обновленный проект
	var updatedProject models.Project
	err = projectsCollection.FindOne(ctx, bson.M{"_id": insertedID}).Decode(&updatedProject)
	require.NoError(t, err)
	
	// Проверяем, что данные проекта обновились
	assert.Equal(t, "Updated Project", updatedProject.Name)
	assert.Equal(t, "This project has been updated", updatedProject.Description)
	assert.Equal(t, testProject.UserID, updatedProject.UserID)
	
	// Удаляем проект
	_, err = projectsCollection.DeleteOne(ctx, bson.M{"_id": insertedID})
	require.NoError(t, err)
	
	// Проверяем, что проект удален
	count, err := projectsCollection.CountDocuments(ctx, bson.M{"_id": insertedID})
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
} 