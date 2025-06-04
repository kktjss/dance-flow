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

// Errors
var (
	ErrProjectNotFound = errors.New("project not found")
)

// ProjectRepository defines the interface for project data access
type ProjectRepository interface {
	FindAll(userID string) ([]models.Project, error)
	FindByUserID(userID string) ([]models.Project, error)
	FindByID(projectID string) (*models.Project, error)
	Create(project *models.Project) (*models.Project, error)
	Update(projectID string, updates map[string]interface{}) (*models.Project, error)
	Delete(projectID string) error
}

// projectRepository implements ProjectRepository
type projectRepository struct {
	db *mongo.Database
}

// NewProjectRepository creates a new project repository
func NewProjectRepository(db *mongo.Database) ProjectRepository {
	return &projectRepository{
		db: db,
	}
}

// FindAll returns all projects for a user (including public projects)
func (r *projectRepository) FindAll(userID string) ([]models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Find projects that are either owned by the user or are public
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

// FindByUserID returns all projects owned by a user
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

// FindByID returns a project by ID
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

// Create creates a new project
func (r *projectRepository) Create(project *models.Project) (*models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Set ID if not set
	if project.ID == "" {
		project.ID = primitive.NewObjectID().Hex()
	}

	result, err := r.db.Collection("projects").InsertOne(ctx, project)
	if err != nil {
		return nil, err
	}

	// Get the created project
	var createdProject models.Project
	err = r.db.Collection("projects").FindOne(ctx, bson.M{"_id": result.InsertedID}).Decode(&createdProject)
	if err != nil {
		return nil, err
	}

	return &createdProject, nil
}

// Update updates an existing project
func (r *projectRepository) Update(projectID string, updates map[string]interface{}) (*models.Project, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	objID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		return nil, err
	}

	// Add updated timestamp
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

	// Get the updated project
	var updatedProject models.Project
	err = r.db.Collection("projects").FindOne(ctx, bson.M{"_id": objID}).Decode(&updatedProject)
	if err != nil {
		return nil, err
	}

	return &updatedProject, nil
}

// Delete deletes a project
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
