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

// Ошибки
var (
	ErrEmailAlreadyExists    = errors.New("email already exists")
	ErrUsernameAlreadyExists = errors.New("username already exists")
	ErrInvalidCredentials    = errors.New("invalid credentials")
	ErrInvalidToken         = errors.New("invalid token")
)

// AuthService обрабатывает логику аутентификации
type AuthService struct {
	userRepo       repositories.UserRepositoryInterface
	projectService ProjectService
	jwtSecret      string
}

// NewAuthService создает новый сервис аутентификации
func NewAuthService(userRepo repositories.UserRepositoryInterface, projectService ProjectService, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:       userRepo,
		projectService: projectService,
		jwtSecret:      jwtSecret,
	}
}

// Register создает нового пользователя
func (s *AuthService) Register(username, email, password string) (*models.User, error) {
	// Проверяем, существует ли email
	_, err := s.userRepo.FindByEmail(email)
	if err == nil {
		return nil, ErrEmailAlreadyExists
	}
	if err != repositories.ErrUserNotFound {
		return nil, err
	}

	// Проверяем, существует ли имя пользователя
	_, err = s.userRepo.FindByUsername(username)
	if err == nil {
		return nil, ErrUsernameAlreadyExists
	}
	if err != repositories.ErrUserNotFound {
		return nil, err
	}

	// Создаем нового пользователя
	user := &models.User{
		ID:        primitive.NewObjectID(),
		Username:  username,
		Email:     email,
		Password:  password,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Хешируем пароль
	if err := user.HashPassword(); err != nil {
		return nil, err
	}

	// Сохраняем пользователя
	createdUser, err := s.userRepo.Create(user)
	if err != nil {
		return nil, err
	}

	// Создаем проекты по умолчанию для нового пользователя
	err = s.projectService.CreateDefaultProjects(createdUser.ID.Hex())
	if err != nil {
		// Логируем ошибку, но не прерываем регистрацию
		log.Printf("Не удалось создать проекты по умолчанию для пользователя %s: %v", createdUser.ID.Hex(), err)
	}

	return createdUser, nil
}

// Login аутентифицирует пользователя и возвращает токен
func (s *AuthService) Login(email, password string) (string, *models.User, error) {
	// Ищем пользователя по email
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		if err == repositories.ErrUserNotFound {
			return "", nil, ErrInvalidCredentials
		}
		return "", nil, err
	}

	// Проверяем пароль
	if !user.ComparePassword(password) {
		return "", nil, ErrInvalidCredentials
	}

	// Генерируем токен
	token, err := s.GenerateToken(user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// GenerateToken создает JWT токен для пользователя
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

// VerifyToken проверяет JWT токен и возвращает claims
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

// GetUserFromToken извлекает информацию о пользователе из JWT токена
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

// ResetPassword сбрасывает пароль пользователя
func (s *AuthService) ResetPassword(userID, newPassword string) error {
	// Хешируем новый пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Обновляем пароль пользователя
	updates := map[string]interface{}{
		"password":  string(hashedPassword),
		"updatedAt": time.Now(),
	}

	_, err = s.userRepo.Update(userID, updates)
	return err
} 