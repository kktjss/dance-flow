package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// User model
type User struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Username     string             `json:"username" bson:"username"`
	Name         string             `json:"name" bson:"name,omitempty"`
	Email        string             `json:"email" bson:"email"`
	Password     string             `json:"password,omitempty" bson:"password"`
	Role         string             `json:"role" bson:"role,omitempty"`
	Teams        []primitive.ObjectID `json:"teams" bson:"teams"`
	CreatedAt    time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt    time.Time          `json:"updatedAt" bson:"updatedAt,omitempty"`
}

// TeamRef represents a team reference in User model
type TeamRef struct {
	TeamID primitive.ObjectID `json:"teamId" bson:"teamId"`
	Role   string             `json:"role" bson:"role"`
}

// UserResponse is the response model for user data
type UserResponse struct {
	ID        primitive.ObjectID `json:"id"`
	Username  string             `json:"username"`
	Name      string             `json:"name,omitempty"`
	Email     string             `json:"email"`
	Role      string             `json:"role,omitempty"`
	Teams     []primitive.ObjectID `json:"teams"`
	CreatedAt time.Time          `json:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt,omitempty"`
}

// ToResponse converts a User to UserResponse, removing sensitive fields
func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		Name:      u.Name,
		Email:     u.Email,
		Role:      u.Role,
		Teams:     u.Teams,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}

// HashPassword hashes a user password
func (u *User) HashPassword() error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// ComparePassword checks if the provided password matches the stored hash
func (u *User) ComparePassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
} 