package services

import (
	"errors"
	"log"
	"time"

	"github.com/dgrijalva/jwt-go"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"

	"github.com/kktjss/dance-flow/models"
	"github.com/kktjss/dance-flow/repositories"
)

// Errors
var (
	ErrEmailAlreadyExists    = errors.New("email already exists")
	ErrUsernameAlreadyExists = errors.New("username already exists")
	ErrInvalidCredentials    = errors.New("invalid credentials")
	ErrInvalidToken         = errors.New("invalid token")
)

// AuthService handles authentication logic
type AuthService struct {
	userRepo       repositories.UserRepositoryInterface
	projectService ProjectService
	jwtSecret      string
}

// NewAuthService creates a new auth service
func NewAuthService(userRepo repositories.UserRepositoryInterface, projectService ProjectService, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:       userRepo,
		projectService: projectService,
		jwtSecret:      jwtSecret,
	}
}

// Register creates a new user
func (s *AuthService) Register(username, email, password string) (*models.User, error) {
	// Check if email already exists
	_, err := s.userRepo.FindByEmail(email)
	if err == nil {
		return nil, ErrEmailAlreadyExists
	}
	if err != repositories.ErrUserNotFound {
		return nil, err
	}

	// Check if username already exists
	_, err = s.userRepo.FindByUsername(username)
	if err == nil {
		return nil, ErrUsernameAlreadyExists
	}
	if err != repositories.ErrUserNotFound {
		return nil, err
	}

	// Create new user
	user := &models.User{
		ID:        primitive.NewObjectID(),
		Username:  username,
		Email:     email,
		Password:  password,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Hash password
	if err := user.HashPassword(); err != nil {
		return nil, err
	}

	// Save user
	createdUser, err := s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	// Create default projects for the new user
	err = s.projectService.CreateDefaultProjects(createdUser.ID.Hex())
	if err != nil {
		// Log the error but don't fail the registration
		log.Printf("Failed to create default projects for user %s: %v", createdUser.ID.Hex(), err)
	}

	return createdUser, nil
}

// Login authenticates a user and returns a token
func (s *AuthService) Login(email, password string) (string, *models.User, error) {
	// Find user by email
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if err == repositories.ErrUserNotFound {
			return "", nil, ErrInvalidCredentials
		}
		return "", nil, err
	}

	// Check password
	if !user.ComparePassword(password) {
		return "", nil, ErrInvalidCredentials
	}

	// Generate token
	token, err := s.GenerateToken(user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// GenerateToken creates a JWT token for a user
func (s *AuthService) GenerateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"id":       user.ID.Hex(),
		"username": user.Username,
		"email":    user.Email,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// VerifyToken validates a JWT token and returns the claims
func (s *AuthService) VerifyToken(tokenString string) (jwt.MapClaims, error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetUserFromToken extracts user information from a JWT token
func (s *AuthService) GetUserFromToken(tokenString string) (*models.User, error) {
	claims, err := s.VerifyToken(tokenString)
	if err != nil {
		return nil, err
	}

	userID, ok := claims["id"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	return s.userRepo.FindByID(userID)
}

// ResetPassword resets a user's password
func (s *AuthService) ResetPassword(userID, newPassword string) error {
	// Hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Update the user's password
	updates := map[string]interface{}{
		"password":  string(hashedPassword),
		"updatedAt": time.Now(),
	}

	_, err = s.userRepo.Update(userID, updates)
	return err
} 