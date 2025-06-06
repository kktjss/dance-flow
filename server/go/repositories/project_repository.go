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
	ErrProjectNotFound = errors.New("project not found")
)

// ProjectRepository определяет интерфейс для доступа к данным проектов
type ProjectRepository interface {
	FindAll(userID string) ([]models.Project, error)
	FindByUserID(userID string) ([]models.Project, error)
	FindByID(projectID string) (*models.Project, error)
	Create(project *models.Project) (*models.Project, error)
	Update(projectID string, updates map[string]interface{}) (*models.Project, error)
	Delete(projectID string) error
}

// projectRepository реализует ProjectRepository
type projectRepository struct {
	db *mongo.Database
}

// NewProjectRepository создает новый репозиторий проектов
func NewProjectRepository(db *mongo.Database) ProjectRepository {
	return &projectRepository{
		db: db,
	}
}

// FindAll возвращает все проекты пользователя (включая публичные проекты)
func (r *projectRepository) FindAll(userID string) ([]models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Находим проекты, которые либо принадлежат пользователю, либо являются публичными
	filter := bson.M{
		"$or": []bson.M{
			{"userId": userID},
			{"isPrivate": false},
		},
	}

	cursor, err := r.db.Collection("projects").Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var projects []models.Project
	if err = cursor.All(ctx, &projects); err != nil {
		return nil, err
	}

	return projects, nil
}

// FindByUserID возвращает все проекты, принадлежащие пользователю
func (r *projectRepository) FindByUserID(userID string) ([]models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := r.db.Collection("projects").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var projects []models.Project
	if err = cursor.All(ctx, &projects); err != nil {
		return nil, err
	}

	return projects, nil
}

// FindByID возвращает проект по ID
func (r *projectRepository) FindByID(projectID string) (*models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, err
	}

	var project models.Project
	err = r.db.Collection("projects").FindOne(ctx, bson.M{"_id": objID}).Decode(&project)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, ErrProjectNotFound
		}
		return nil, err
	}

	return &project, nil
}

// Create создает новый проект
func (r *projectRepository) Create(project *models.Project) (*models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Устанавливаем ID, если он не установлен
	if project.ID == "" {
		project.ID = primitive.NewObjectID().Hex()
	}

	result, err := r.db.Collection("projects").InsertOne(ctx, project)
	if err != nil {
		return nil, err
	}

	// Получаем созданный проект
	var createdProject models.Project
	err = r.db.Collection("projects").FindOne(ctx, bson.M{"_id": result.InsertedID}).Decode(&createdProject)
	if err != nil {
		return nil, err
	}

	return &createdProject, nil
}

// Update обновляет существующий проект
func (r *projectRepository) Update(projectID string, updates map[string]interface{}) (*models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, err
	}

	// Добавляем временную метку обновления
	updates["updatedAt"] = time.Now()

	result, err := r.db.Collection("projects").UpdateOne(
		ctx,
		bson.M{"_id": objID},
		bson.M{"$set": updates},
	)

	if err != nil {
		return nil, err
	}

	if result.MatchedCount == 0 {
		return nil, ErrProjectNotFound
	}

	// Получаем обновленный проект
	var updatedProject models.Project
	err = r.db.Collection("projects").FindOne(ctx, bson.M{"_id": objID}).Decode(&updatedProject)
	if err != nil {
		return nil, err
	}

	return &updatedProject, nil
}

// Delete удаляет проект
func (r *projectRepository) Delete(projectID string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return err
	}

	result, err := r.db.Collection("projects").DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return ErrProjectNotFound
	}

	return nil
}
