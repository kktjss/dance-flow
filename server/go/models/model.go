package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Model represents a 3D model in the system
type Model struct {
	ID           primitive.ObjectID `json:"id" bson:"_id"`
	Name         string             `json:"name" bson:"name"`
	Filename     string             `json:"filename" bson:"filename"`
	OriginalName string             `json:"originalName" bson:"originalName"`
	Size         int64              `json:"size" bson:"size"`
	UserID       primitive.ObjectID `json:"userId" bson:"userId"`
	CreatedAt    time.Time          `json:"createdAt" bson:"createdAt"`
	URL          string             `json:"url" bson:"-"` // URL is not stored in the database
} 