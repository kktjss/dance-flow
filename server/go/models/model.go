package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Model представляет 3D модель в системе
type Model struct {
	ID           primitive.ObjectID `json:"id" bson:"_id"`
	Name         string             `json:"name" bson:"name"`
	Filename     string             `json:"filename" bson:"filename"`
	OriginalName string             `json:"originalName" bson:"originalName"`
	Size         int64              `json:"size" bson:"size"`
	UserID       primitive.ObjectID `json:"userId" bson:"userId"`
	CreatedAt    time.Time          `json:"createdAt" bson:"createdAt"`
	URL          string             `json:"url" bson:"-"` // URL не хранится в базе данных
} 