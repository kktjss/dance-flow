package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Ошибки
var (
	ErrUserNotFound = errors.New("user not found")
)

// UserRepositoryInterface определяет методы для репозитория пользователей
type UserRepositoryInterface interface {
	FindByID(id string) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	FindByUsername(username string) (*models.User, error)
	Create(user *models.User) (*models.User, error)
	Update(id string, updates map[string]interface{}) (*models.User, error)
	Delete(id string) error
	SearchUsers(query string) ([]models.User, error)
}

// UserRepository реализует UserRepositoryInterface
type UserRepository struct {
	db *mongo.Database
}

// NewUserRepository создает новый репозиторий пользователей
func NewUserRepository(db *mongo.Database) UserRepositoryInterface {
	return &UserRepository{
		db: db,
	}
}

// FindByID находит пользователя по ID
func (r *UserRepository) FindByID(id string) (*models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var user models.User
	err = r.db.Collection("users").FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// FindByEmail находит пользователя по email
func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := r.db.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// FindByUsername находит пользователя по имени пользователя
func (r *UserRepository) FindByUsername(username string) (*models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err := r.db.Collection("users").FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	return &user, nil
}

// Create создает нового пользователя
func (r *UserRepository) Create(user *models.User) (*models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Устанавливаем ID, если он не установлен
	if user.ID.IsZero() {
		user.ID = primitive.NewObjectID()
	}

	result, err := r.db.Collection("users").InsertOne(ctx, user)
	if err != nil {
		return nil, err
	}

	// Получаем созданного пользователя
	var createdUser models.User
	err = r.db.Collection("users").FindOne(ctx, bson.M{"_id": result.InsertedID}).Decode(&createdUser)
	if err != nil {
		return nil, err
	}

	return &createdUser, nil
}

// Update обновляет пользователя
func (r *UserRepository) Update(id string, updates map[string]interface{}) (*models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	result, err := r.db.Collection("users").UpdateOne(
		ctx,
		bson.M{"_id": objID},
		bson.M{"$set": updates},
	)

	if err != nil {
		return nil, err
	}

	if result.MatchedCount == 0 {
		return nil, ErrUserNotFound
	}

	// Получаем обновленного пользователя
	var updatedUser models.User
	err = r.db.Collection("users").FindOne(ctx, bson.M{"_id": objID}).Decode(&updatedUser)
	if err != nil {
		return nil, err
	}

	return &updatedUser, nil
}

// Delete удаляет пользователя
func (r *UserRepository) Delete(id string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.db.Collection("users").DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return ErrUserNotFound
	}

	return nil
}

// SearchUsers выполняет поиск пользователей
func (r *UserRepository) SearchUsers(query string) ([]models.User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{
		"$or": []bson.M{
			{"username": bson.M{"$regex": query, "$options": "i"}},
			{"email": bson.M{"$regex": query, "$options": "i"}},
		},
	}

	cursor, err := r.db.Collection("users").Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err = cursor.All(ctx, &users); err != nil {
		return nil, err
	}

	return users, nil
} 