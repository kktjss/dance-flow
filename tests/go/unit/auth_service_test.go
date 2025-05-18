package unit

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"

	"dance-flow/server/go/models"
	"dance-flow/server/go/repositories"
	"dance-flow/server/go/services"
)

// Create a mock user repository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) FindByID(id string) (*models.User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) FindByEmail(email string) (*models.User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) FindByUsername(username string) (*models.User, error) {
	args := m.Called(username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Create(user *models.User) (*models.User, error) {
	args := m.Called(user)
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Update(id string, updates map[string]interface{}) (*models.User, error) {
	args := m.Called(id, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) Delete(id string) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserRepository) SearchUsers(query string) ([]models.User, error) {
	args := m.Called(query)
	return args.Get(0).([]models.User), args.Error(1)
}

func TestAuthService_Register(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service with the mock repository
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Test case 1: Successful registration
	mockRepo.On("FindByEmail", "new@example.com").Return(nil, repositories.ErrUserNotFound)
	mockRepo.On("FindByUsername", "newuser").Return(nil, repositories.ErrUserNotFound)
	
	// Set up mock for user creation
	mockRepo.On("Create", mock.AnythingOfType("*models.User")).Return(func(user *models.User) *models.User {
		user.ID = primitive.NewObjectID().Hex()
		return user
	}, nil)
	
	// Register a new user
	user, err := authService.Register("newuser", "new@example.com", "password123")
	
	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, "newuser", user.Username)
	assert.Equal(t, "new@example.com", user.Email)
	
	// Verify that the password was hashed
	assert.NotEqual(t, "password123", user.Password)
	
	// Test case 2: Email already exists
	mockRepo.On("FindByEmail", "existing@example.com").Return(&models.User{}, nil)
	
	_, err = authService.Register("anotheruser", "existing@example.com", "password123")
	
	// Should return an error
	assert.Error(t, err)
	assert.Equal(t, services.ErrEmailAlreadyExists, err)
	
	// Test case 3: Username already exists
	mockRepo.On("FindByEmail", "another@example.com").Return(nil, repositories.ErrUserNotFound)
	mockRepo.On("FindByUsername", "existinguser").Return(&models.User{}, nil)
	
	_, err = authService.Register("existinguser", "another@example.com", "password123")
	
	// Should return an error
	assert.Error(t, err)
	assert.Equal(t, services.ErrUsernameAlreadyExists, err)
	
	// Verify that the mock expectations were met
	mockRepo.AssertExpectations(t)
}

func TestAuthService_Login(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service with the mock repository
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Create a test user with hashed password
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	testUser := &models.User{
		ID:       primitive.NewObjectID().Hex(),
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(hashedPassword),
	}
	
	// Test case 1: Successful login
	mockRepo.On("FindByEmail", "test@example.com").Return(testUser, nil)
	
	token, user, err := authService.Login("test@example.com", "password123")
	
	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, token)
	assert.NotNil(t, user)
	assert.Equal(t, testUser.ID, user.ID)
	assert.Equal(t, testUser.Username, user.Username)
	assert.Equal(t, testUser.Email, user.Email)
	
	// Verify that the token is valid
	tokenClaims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(token, tokenClaims, func(token *jwt.Token) (interface{}, error) {
		return []byte("test_secret"), nil
	})
	assert.NoError(t, err)
	
	// Check claims
	assert.Equal(t, testUser.ID, tokenClaims["id"])
	assert.Equal(t, testUser.Username, tokenClaims["username"])
	
	// Test case 2: User not found
	mockRepo.On("FindByEmail", "nonexistent@example.com").Return(nil, repositories.ErrUserNotFound)
	
	_, _, err = authService.Login("nonexistent@example.com", "password123")
	
	// Should return an error
	assert.Error(t, err)
	assert.Equal(t, services.ErrInvalidCredentials, err)
	
	// Test case 3: Incorrect password
	_, _, err = authService.Login("test@example.com", "wrongpassword")
	
	// Should return an error
	assert.Error(t, err)
	assert.Equal(t, services.ErrInvalidCredentials, err)
	
	// Verify that the mock expectations were met
	mockRepo.AssertExpectations(t)
}

func TestAuthService_VerifyToken(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service with the mock repository
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Create a test user
	testUser := &models.User{
		ID:       primitive.NewObjectID().Hex(),
		Username: "testuser",
		Email:    "test@example.com",
	}
	
	// Configure the mock repository
	mockRepo.On("FindByID", testUser.ID).Return(testUser, nil)
	
	// Generate a valid token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       testUser.ID,
		"username": testUser.Username,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})
	
	validToken, _ := token.SignedString([]byte("test_secret"))
	
	// Test case 1: Valid token
	claims, err := authService.VerifyToken(validToken)
	
	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, claims)
	assert.Equal(t, testUser.ID, claims["id"])
	assert.Equal(t, testUser.Username, claims["username"])
	
	// Test case 2: Invalid token
	_, err = authService.VerifyToken("invalid.token.string")
	
	// Should return an error
	assert.Error(t, err)
	
	// Test case 3: Expired token
	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       testUser.ID,
		"username": testUser.Username,
		"exp":      time.Now().Add(-time.Hour).Unix(), // Expired 1 hour ago
	})
	
	expiredTokenString, _ := expiredToken.SignedString([]byte("test_secret"))
	
	_, err = authService.VerifyToken(expiredTokenString)
	
	// Should return an error
	assert.Error(t, err)
	
	// Verify that the mock expectations were met
	mockRepo.AssertExpectations(t)
}

func TestAuthService_GetUserFromToken(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service with the mock repository
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Create a test user
	testUser := &models.User{
		ID:       primitive.NewObjectID().Hex(),
		Username: "testuser",
		Email:    "test@example.com",
	}
	
	// Configure the mock repository
	mockRepo.On("FindByID", testUser.ID).Return(testUser, nil)
	
	// Generate a valid token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       testUser.ID,
		"username": testUser.Username,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})
	
	validToken, _ := token.SignedString([]byte("test_secret"))
	
	// Test case 1: Valid token
	user, err := authService.GetUserFromToken(validToken)
	
	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.Equal(t, testUser.ID, user.ID)
	assert.Equal(t, testUser.Username, user.Username)
	assert.Equal(t, testUser.Email, user.Email)
	
	// Test case 2: Invalid token
	_, err = authService.GetUserFromToken("invalid.token.string")
	
	// Should return an error
	assert.Error(t, err)
	
	// Test case 3: Valid token but user not found
	mockRepo.On("FindByID", "nonexistent").Return(nil, repositories.ErrUserNotFound)
	
	nonexistentToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":       "nonexistent",
		"username": "nonexistentuser",
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
	})
	
	nonexistentTokenString, _ := nonexistentToken.SignedString([]byte("test_secret"))
	
	_, err = authService.GetUserFromToken(nonexistentTokenString)
	
	// Should return an error
	assert.Error(t, err)
	
	// Verify that the mock expectations were met
	mockRepo.AssertExpectations(t)
}

func TestAuthService_ResetPassword(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service with the mock repository
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Create a test user with hashed password
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("oldpassword"), bcrypt.DefaultCost)
	testUser := &models.User{
		ID:       primitive.NewObjectID().Hex(),
		Username: "testuser",
		Email:    "test@example.com",
		Password: string(hashedPassword),
	}
	
	// Configure the mock repository
	mockRepo.On("FindByEmail", "test@example.com").Return(testUser, nil)
	mockRepo.On("Update", testUser.ID, mock.AnythingOfType("map[string]interface {}")).Return(func(id string, updates map[string]interface{}) *models.User {
		// Update the test user with the new password
		testUser.Password = updates["password"].(string)
		return testUser
	}, nil)
	
	// Test case 1: Successful password reset
	user, err := authService.ResetPassword("test@example.com", "newpassword")
	
	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, user)
	
	// Verify that the password was updated and hashed
	assert.NotEqual(t, "newpassword", user.Password)
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("newpassword"))
	assert.NoError(t, err)
	
	// Test case 2: User not found
	mockRepo.On("FindByEmail", "nonexistent@example.com").Return(nil, repositories.ErrUserNotFound)
	
	_, err = authService.ResetPassword("nonexistent@example.com", "newpassword")
	
	// Should return an error
	assert.Error(t, err)
	assert.Equal(t, repositories.ErrUserNotFound, err)
	
	// Test case 3: Repository error
	mockRepo.On("FindByEmail", "error@example.com").Return(nil, errors.New("database error"))
	
	_, err = authService.ResetPassword("error@example.com", "newpassword")
	
	// Should return an error
	assert.Error(t, err)
	
	// Verify that the mock expectations were met
	mockRepo.AssertExpectations(t)
}

func TestAuthService_GenerateToken(t *testing.T) {
	// Create a mock repository
	mockRepo := new(MockUserRepository)
	
	// Create an auth service
	authService := services.NewAuthService(mockRepo, "test_secret")
	
	// Create a test user
	testUser := &models.User{
		ID:       primitive.NewObjectID().Hex(),
		Username: "testuser",
		Email:    "test@example.com",
	}
	
	// Generate a token
	token, err := authService.GenerateToken(testUser)
	
	// Assertions
	assert.NoError(t, err)
	assert.NotEmpty(t, token)
	
	// Verify that the token is valid
	tokenClaims := jwt.MapClaims{}
	_, err = jwt.ParseWithClaims(token, tokenClaims, func(token *jwt.Token) (interface{}, error) {
		return []byte("test_secret"), nil
	})
	assert.NoError(t, err)
	
	// Check claims
	assert.Equal(t, testUser.ID, tokenClaims["id"])
	assert.Equal(t, testUser.Username, tokenClaims["username"])
	
	// Check that expiration is set
	assert.NotNil(t, tokenClaims["exp"])
	
	// Verify that the token expiration is in the future
	expTime := time.Unix(int64(tokenClaims["exp"].(float64)), 0)
	assert.True(t, expTime.After(time.Now()))
} 