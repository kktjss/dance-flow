package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// Модель пользователя
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

// TeamRef представляет ссылку на команду в модели User
type TeamRef struct {
	TeamID primitive.ObjectID `json:"teamId" bson:"teamId"`
	Role   string             `json:"role" bson:"role"`
}

// UserResponse является моделью ответа для данных пользователя
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

// ToResponse преобразует User в UserResponse, удаляя конфиденциальные поля
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

// HashPassword хеширует пароль пользователя
func (u *User) HashPassword() error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedPassword)
	return nil
}

// ComparePassword проверяет, соответствует ли предоставленный пароль сохраненному хешу
func (u *User) ComparePassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
} 