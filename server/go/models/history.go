package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Доступные действия истории
const (
	ActionProjectCreated    = "PROJECT_CREATED"
	ActionProjectUpdated    = "PROJECT_UPDATED"
	ActionTeamMemberAdded   = "TEAM_MEMBER_ADDED"
	ActionTeamMemberRemoved = "TEAM_MEMBER_REMOVED"
	ActionTeamProjectUpdated = "TEAM_PROJECT_UPDATED"
)

// History представляет запись в истории действий пользователя
type History struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      primitive.ObjectID `bson:"userId" json:"userId"`
	ProjectID   primitive.ObjectID `bson:"projectId" json:"projectId"`
	Action      string             `bson:"action" json:"action"`
	Description string             `bson:"description" json:"description"`
	Timestamp   time.Time          `bson:"timestamp" json:"timestamp"`
}

// CreateHistory создает новую запись в истории с текущей временной меткой
func CreateHistory(userID, projectID primitive.ObjectID, action, description string) History {
	return History{
		UserID:      userID,
		ProjectID:   projectID,
		Action:      action,
		Description: description,
		Timestamp:   time.Now(),
	}
} 