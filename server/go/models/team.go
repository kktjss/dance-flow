package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Team model
type Team struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name        string             `json:"name" bson:"name"`
	Description string             `json:"description" bson:"description"`
	Owner       primitive.ObjectID `json:"owner" bson:"owner"`
	Members     []Member           `json:"members" bson:"members"`
	Projects    []string           `json:"projects,omitempty" bson:"projects,omitempty"`
	CreatedAt   time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updatedAt"`
}

// Member represents a team member
type Member struct {
	UserID primitive.ObjectID `json:"userId" bson:"userId"`
	Role   string             `json:"role" bson:"role"`
	Name   string             `json:"name,omitempty" bson:"name,omitempty"`
	Email  string             `json:"email,omitempty" bson:"email,omitempty"`
}

// TeamCreateInput is the input for creating a team
type TeamCreateInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// TeamUpdateInput is the input for updating a team
type TeamUpdateInput struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
}

// TeamAddMemberInput is the input for adding a member to a team
type TeamAddMemberInput struct {
	UserID string `json:"userId" binding:"required"`
	Role   string `json:"role" binding:"required"`
} 