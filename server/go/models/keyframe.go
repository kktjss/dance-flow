package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Keyframe model
type Keyframe struct {
	ID          primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	ProjectID   primitive.ObjectID `json:"projectId" bson:"projectId"`
	Timestamp   float64            `json:"timestamp" bson:"timestamp"`
	Label       string             `json:"label,omitempty" bson:"label,omitempty"`
	PoseData    interface{}        `json:"poseData" bson:"poseData"`
	ImageData   string             `json:"imageData,omitempty" bson:"imageData,omitempty"`
	CreatedBy   primitive.ObjectID `json:"createdBy" bson:"createdBy"`
	CreatedAt   time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt   time.Time          `json:"updatedAt" bson:"updatedAt"`
}

// KeyframeCreateInput is the input for creating a keyframe
type KeyframeCreateInput struct {
	ProjectID string      `json:"projectId" binding:"required"`
	Timestamp float64     `json:"timestamp" binding:"required"`
	Label     string      `json:"label,omitempty"`
	PoseData  interface{} `json:"poseData" binding:"required"`
	ImageData string      `json:"imageData,omitempty"`
}

// KeyframeUpdateInput is the input for updating a keyframe
type KeyframeUpdateInput struct {
	Label     string      `json:"label,omitempty"`
	PoseData  interface{} `json:"poseData,omitempty"`
	ImageData string      `json:"imageData,omitempty"`
} 