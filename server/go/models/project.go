package models

// Project represents a dance project
type Project struct {
	ID          string   `json:"id" bson:"_id,omitempty"`
	Name        string   `json:"name" bson:"name"`
	Description string   `json:"description" bson:"description"`
	UserID      string   `json:"userId" bson:"userId"`
	DanceStyle  string   `json:"danceStyle" bson:"danceStyle"`
	Tags        []string `json:"tags" bson:"tags"`
	IsPrivate   bool     `json:"isPrivate" bson:"isPrivate"`
} 