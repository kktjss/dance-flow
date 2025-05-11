package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Project model
type Project struct {
	ID            primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name          string             `json:"name" bson:"name"`
	Description   string             `json:"description" bson:"description"`
	Owner         primitive.ObjectID `json:"owner" bson:"owner"`
	TeamID        primitive.ObjectID `json:"teamId,omitempty" bson:"teamId,omitempty"`
	VideoURL      string             `json:"videoUrl,omitempty" bson:"videoUrl,omitempty"`
	Keyframes     []KeyframeRef      `json:"keyframes,omitempty" bson:"keyframes,omitempty"`
	KeyframesJSON string             `json:"keyframesJson,omitempty" bson:"keyframesJson,omitempty"`
	Tags          []string           `json:"tags,omitempty" bson:"tags,omitempty"`
	CreatedAt     time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt" bson:"updatedAt"`
	IsPrivate     bool               `json:"isPrivate" bson:"isPrivate"`
	Title         string             `json:"title" bson:"title"`
}

// KeyframeRef represents a keyframe reference in Project model
type KeyframeRef struct {
	KeyframeID primitive.ObjectID `json:"keyframeId" bson:"keyframeId"`
	Timestamp  float64            `json:"timestamp" bson:"timestamp"`
	Label      string             `json:"label,omitempty" bson:"label,omitempty"`
}

// ProjectCreateInput is the input for creating a project
type ProjectCreateInput struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	TeamID      string   `json:"teamId,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Title       string   `json:"title"`
	IsPrivate   bool     `json:"isPrivate"`
}

// ProjectUpdateInput is the input for updating a project
type ProjectUpdateInput struct {
	Name        string   `json:"name,omitempty"`
	Description string   `json:"description,omitempty"`
	TeamID      string   `json:"teamId,omitempty"`
	VideoURL    string   `json:"videoUrl,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Title       string   `json:"title,omitempty"`
	IsPrivate   *bool    `json:"isPrivate,omitempty"`
} 