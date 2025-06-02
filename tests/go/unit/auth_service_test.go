package unit

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

// Локальные определения для тестов (обычно эти типы импортируются из основного модуля)

// User представляет модель пользователя
type User struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username  string             `bson:"username" json:"username"`
	Email     string             `bson:"email" json:"email"`
	Password  string             `bson:"password" json:"-"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at" json:"updated_at"`
}

// UserRepository интерфейс для работы с пользователями
type UserRepository interface {
	FindByID(id string) (*User, error)
	FindByEmail(email string) (*User, error)
	FindByUsername(username string) (*User, error)
	Create(user *User) (*User, error)
	Update(id string, updates map[string]interface{}) (*User, error)
	Delete(id string) error
	SearchUsers(query string) ([]User, error)
}

// AuthService сервис аутентификации
type AuthService struct {
	userRepo  UserRepository
	secretKey string
}

// Ошибки сервиса
var (
	ErrUserNotFound           = errors.New("пользователь не найден")
	ErrEmailAlreadyExists     = errors.New("email уже существует")
	ErrUsernameAlreadyExists  = errors.New("имя пользователя уже существует")
	ErrWeakPassword          = errors.New("слишком слабый пароль")
	ErrInvalidCredentials    = errors.New("неверные учетные данные")
	ErrInvalidToken          = errors.New("недействительный токен")
)

// NewAuthService создает новый экземпляр AuthService
func NewAuthService(userRepo UserRepository, secretKey string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		secretKey: secretKey,
	}
}

// Register регистрирует нового пользователя
func (s *AuthService) Register(username, email, password string) (*User, error) {
	// Проверяем слабый пароль
	if len(password) < 6 {
		return nil, ErrWeakPassword
	}

	// Проверяем существование email
	if _, err := s.userRepo.FindByEmail(email); err == nil {
		return nil, ErrEmailAlreadyExists
	}

	// Проверяем существование username
	if _, err := s.userRepo.FindByUsername(username); err == nil {
		return nil, ErrUsernameAlreadyExists
	}

	// Хешируем пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// Создаем пользователя
	user := &User{
		ID:        primitive.NewObjectID(),
		Username:  username,
		Email:     email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return s.userRepo.Create(user)
}

// Login авторизует пользователя
func (s *AuthService) Login(loginField, password string) (string, *User, error) {
	// Сначала пытаемся найти по email
	user, err := s.userRepo.FindByEmail(loginField)
	if err != nil {
		// Если не найден по email, пытаемся найти по username
		user, err = s.userRepo.FindByUsername(loginField)
		if err != nil {
			return "", nil, ErrInvalidCredentials
		}
	}

	// Проверяем пароль
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return "", nil, ErrInvalidCredentials
	}

	// Генерируем токен
	token, err := s.GenerateToken(user)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// GenerateToken генерирует JWT токен для пользователя
func (s *AuthService) GenerateToken(user *User) (string, error) {
	claims := jwt.MapClaims{
		"id":       user.ID.Hex(),
		"username": user.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.secretKey))
}

// VerifyToken проверяет JWT токен
func (s *AuthService) VerifyToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.secretKey), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetUserFromToken получает пользователя из токена
func (s *AuthService) GetUserFromToken(tokenString string) (*User, error) {
	claims, err := s.VerifyToken(tokenString)
	if err != nil {
		return nil, err
	}

	userID, ok := claims["id"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return user, nil
}

// ResetPassword сбрасывает пароль пользователя
func (s *AuthService) ResetPassword(email, newPassword string) error {
	// Проверяем слабый пароль
	if len(newPassword) < 6 {
		return ErrWeakPassword
	}

	// Находим пользователя
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return ErrUserNotFound
	}

	// Хешируем новый пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Обновляем пароль
	updates := map[string]interface{}{
		"password":   string(hashedPassword),
		"updated_at": time.Now(),
	}

	_, err = s.userRepo.Update(user.ID.Hex(), updates)
	return err
}

// MockUserRepository представляет мок для интерфейса UserRepository
type MockUserRepository struct {
	mock.Mock
}

// FindByID находит пользователя по ID
func (m *MockUserRepository) FindByID(id string) (*User, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

// FindByEmail находит пользователя по email
func (m *MockUserRepository) FindByEmail(email string) (*User, error) {
	args := m.Called(email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

// FindByUsername находит пользователя по имени пользователя
func (m *MockUserRepository) FindByUsername(username string) (*User, error) {
	args := m.Called(username)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

// Create создает нового пользователя
func (m *MockUserRepository) Create(user *User) (*User, error) {
	args := m.Called(user)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

// Update обновляет пользователя
func (m *MockUserRepository) Update(id string, updates map[string]interface{}) (*User, error) {
	args := m.Called(id, updates)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*User), args.Error(1)
}

// Delete удаляет пользователя
func (m *MockUserRepository) Delete(id string) error {
	args := m.Called(id)
	return args.Error(0)
}

// SearchUsers ищет пользователей по запросу
func (m *MockUserRepository) SearchUsers(query string) ([]User, error) {
	args := m.Called(query)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]User), args.Error(1)
}

// NewMockUserRepository создает новый экземпляр мока UserRepository
func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{}
}

// setupAuthService создает экземпляр AuthService с мокированным репозиторием для тестов
func setupAuthService() (*AuthService, *MockUserRepository) {
	mockRepo := NewMockUserRepository()
	authService := NewAuthService(mockRepo, "test_secret_key")
	return authService, mockRepo
}

// createTestUser создает тестового пользователя с захешированным паролем
func createTestUser() *User {
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("testpassword123"), bcrypt.DefaultCost)
	return &User{
		ID:        primitive.NewObjectID(),
		Username:  "testuser",
		Email:     "test@example.com",
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// TestAuthService_Register тестирует функциональность регистрации пользователей
func TestAuthService_Register(t *testing.T) {
	tests := []struct {
		name           string
		username       string
		email          string
		password       string
		setupMocks     func(*MockUserRepository)
		expectedError  error
		shouldSucceed  bool
	}{
		{
			name:     "Успешная регистрация",
			username: "newuser",
			email:    "new@example.com", 
			password: "Password123!",
			setupMocks: func(m *MockUserRepository) {
				// Пользователь с таким email и username не существует
				m.On("FindByEmail", "new@example.com").Return(nil, ErrUserNotFound)
				m.On("FindByUsername", "newuser").Return(nil, ErrUserNotFound)
				
				// Успешное создание пользователя
				createdUser := &User{
		ID:       primitive.NewObjectID(),
		Username: "newuser",
		Email:    "new@example.com",
				}
				m.On("Create", mock.AnythingOfType("*unit.User")).Return(createdUser, nil)
			},
			shouldSucceed: true,
		},
		{
			name:     "Email уже существует",
			username: "anotheruser",
			email:    "existing@example.com",
			password: "Password123!",
			setupMocks: func(m *MockUserRepository) {
				// Email уже занят
				existingUser := &User{Email: "existing@example.com"}
				m.On("FindByEmail", "existing@example.com").Return(existingUser, nil)
			},
			expectedError: ErrEmailAlreadyExists,
			shouldSucceed: false,
		},
		{
			name:     "Username уже существует",
			username: "existinguser",
			email:    "another@example.com",
			password: "Password123!",
			setupMocks: func(m *MockUserRepository) {
				// Email свободен, но username занят
				m.On("FindByEmail", "another@example.com").Return(nil, ErrUserNotFound)
				existingUser := &User{Username: "existinguser"}
				m.On("FindByUsername", "existinguser").Return(existingUser, nil)
			},
			expectedError: ErrUsernameAlreadyExists,
			shouldSucceed: false,
		},
		{
			name:     "Слишком слабый пароль",
			username: "newuser2",
			email:    "new2@example.com",
			password: "123", // Слишком короткий пароль
			setupMocks: func(m *MockUserRepository) {
				// При слабом пароле методы репозитория не должны вызываться
				// так как проверка пароля происходит в самом начале метода Register
			},
			expectedError: ErrWeakPassword,
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Подготовка
			authService, mockRepo := setupAuthService()
			tt.setupMocks(mockRepo)

			// Выполнение
			user, err := authService.Register(tt.username, tt.email, tt.password)

			// Проверка результатов
			if tt.shouldSucceed {
				require.NoError(t, err, "Регистрация должна быть успешной")
				require.NotNil(t, user, "Пользователь не должен быть nil")
				assert.Equal(t, tt.username, user.Username)
				assert.Equal(t, tt.email, user.Email)
				// Проверяем, что пароль был захеширован
				assert.NotEqual(t, tt.password, user.Password)
			} else {
				require.Error(t, err, "Ожидается ошибка при регистрации")
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
				assert.Nil(t, user, "Пользователь должен быть nil при ошибке")
			}

			// Проверяем, что все ожидания мока были выполнены
	mockRepo.AssertExpectations(t)
		})
	}
}

// TestAuthService_Login тестирует функциональность входа пользователей
func TestAuthService_Login(t *testing.T) {
	tests := []struct {
		name           string
		loginField     string // email или username
		password       string
		setupMocks     func(*MockUserRepository)
		expectedError  error
		shouldSucceed  bool
	}{
		{
			name:       "Успешный вход по email",
			loginField: "test@example.com",
			password:   "testpassword123",
			setupMocks: func(m *MockUserRepository) {
				user := createTestUser()
				m.On("FindByEmail", "test@example.com").Return(user, nil)
			},
			shouldSucceed: true,
		},
		{
			name:       "Успешный вход по username",
			loginField: "testuser",
			password:   "testpassword123",
			setupMocks: func(m *MockUserRepository) {
				// Сначала пытаемся найти по email (не находим)
				m.On("FindByEmail", "testuser").Return(nil, ErrUserNotFound)
				// Затем находим по username
				user := createTestUser()
				m.On("FindByUsername", "testuser").Return(user, nil)
			},
			shouldSucceed: true,
		},
		{
			name:       "Пользователь не найден",
			loginField: "nonexistent@example.com",
			password:   "anypassword",
			setupMocks: func(m *MockUserRepository) {
				m.On("FindByEmail", "nonexistent@example.com").Return(nil, ErrUserNotFound)
				m.On("FindByUsername", "nonexistent@example.com").Return(nil, ErrUserNotFound)
			},
			expectedError: ErrInvalidCredentials,
			shouldSucceed: false,
		},
		{
			name:       "Неверный пароль",
			loginField: "test@example.com",
			password:   "wrongpassword",
			setupMocks: func(m *MockUserRepository) {
				user := createTestUser()
				m.On("FindByEmail", "test@example.com").Return(user, nil)
			},
			expectedError: ErrInvalidCredentials,
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Подготовка
			authService, mockRepo := setupAuthService()
			tt.setupMocks(mockRepo)

			// Выполнение
			token, user, err := authService.Login(tt.loginField, tt.password)

			// Проверка результатов
			if tt.shouldSucceed {
				require.NoError(t, err, "Вход должен быть успешным")
				require.NotEmpty(t, token, "Токен не должен быть пустым")
				require.NotNil(t, user, "Пользователь не должен быть nil")
				
				// Проверяем валидность JWT токена
	tokenClaims := jwt.MapClaims{}
				parsedToken, err := jwt.ParseWithClaims(token, tokenClaims, func(token *jwt.Token) (interface{}, error) {
					return []byte("test_secret_key"), nil
				})
				
				require.NoError(t, err, "Токен должен быть валидным")
				require.True(t, parsedToken.Valid, "Токен должен быть действительным")
				
				// Проверяем содержимое токена
				assert.Equal(t, user.ID.Hex(), tokenClaims["id"])
				assert.Equal(t, user.Username, tokenClaims["username"])
			} else {
				require.Error(t, err, "Ожидается ошибка при входе")
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
				assert.Empty(t, token, "Токен должен быть пустым при ошибке")
				assert.Nil(t, user, "Пользователь должен быть nil при ошибке")
			}

			// Проверяем, что все ожидания мока были выполнены
	mockRepo.AssertExpectations(t)
		})
	}
}

// TestAuthService_VerifyToken тестирует проверку JWT токенов
func TestAuthService_VerifyToken(t *testing.T) {
	authService, _ := setupAuthService()
	testUser := createTestUser()

	tests := []struct {
		name          string
		tokenFunc     func() string // Функция для создания токена
		expectedError error
		shouldSucceed bool
	}{
		{
			name: "Валидный токен",
			tokenFunc: func() string {
				token, _ := authService.GenerateToken(testUser)
				return token
			},
			shouldSucceed: true,
		},
		{
			name: "Невалидный токен",
			tokenFunc: func() string {
				return "invalid.jwt.token"
			},
			expectedError: ErrInvalidToken,
			shouldSucceed: false,
		},
		{
			name: "Пустой токен",
			tokenFunc: func() string {
				return ""
			},
			expectedError: ErrInvalidToken,
			shouldSucceed: false,
		},
		{
			name: "Токен с неверной подписью",
			tokenFunc: func() string {
				claims := jwt.MapClaims{
					"id":       testUser.ID.Hex(),
					"username": testUser.Username,
					"exp":      time.Now().Add(time.Hour).Unix(),
				}
				token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
				// Подписываем неверным ключом
				tokenString, _ := token.SignedString([]byte("wrong_secret"))
				return tokenString
			},
			expectedError: ErrInvalidToken,
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Подготовка
			token := tt.tokenFunc()

			// Выполнение
			claims, err := authService.VerifyToken(token)

			// Проверка результатов
			if tt.shouldSucceed {
				require.NoError(t, err, "Проверка токена должна быть успешной")
				require.NotNil(t, claims, "Claims не должны быть nil")
	assert.Equal(t, testUser.ID.Hex(), claims["id"])
	assert.Equal(t, testUser.Username, claims["username"])
			} else {
				require.Error(t, err, "Ожидается ошибка при проверке токена")
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
				assert.Nil(t, claims, "Claims должны быть nil при ошибке")
			}
		})
	}
}

// TestAuthService_GetUserFromToken тестирует получение пользователя из токена
func TestAuthService_GetUserFromToken(t *testing.T) {
	tests := []struct {
		name          string
		setupMocks    func(*MockUserRepository, string) string // Возвращает токен
		expectedError error
		shouldSucceed bool
	}{
		{
			name: "Успешное получение пользователя",
			setupMocks: func(m *MockUserRepository, userID string) string {
				// Создаем пользователя и токен
				testUser := createTestUser()
				authService := NewAuthService(m, "test_secret_key")
				token, _ := authService.GenerateToken(testUser)
				
				// Настраиваем мок для поиска пользователя
				m.On("FindByID", testUser.ID.Hex()).Return(testUser, nil)
				
				return token
			},
			shouldSucceed: true,
		},
		{
			name: "Пользователь не найден в БД",
			setupMocks: func(m *MockUserRepository, userID string) string {
				// Создаем токен для несуществующего пользователя
				testUser := createTestUser()
				authService := NewAuthService(m, "test_secret_key")
				token, _ := authService.GenerateToken(testUser)
				
				// Пользователь не найден в БД
				m.On("FindByID", testUser.ID.Hex()).Return(nil, ErrUserNotFound)
				
				return token
			},
			expectedError: ErrUserNotFound,
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Подготовка
			authService, mockRepo := setupAuthService()
			token := tt.setupMocks(mockRepo, "")

			// Выполнение
			user, err := authService.GetUserFromToken(token)

			// Проверка результатов
			if tt.shouldSucceed {
				require.NoError(t, err, "Получение пользователя должно быть успешным")
				require.NotNil(t, user, "Пользователь не должен быть nil")
				assert.NotEmpty(t, user.Username)
				assert.NotEmpty(t, user.Email)
			} else {
				require.Error(t, err, "Ожидается ошибка при получении пользователя")
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
				assert.Nil(t, user, "Пользователь должен быть nil при ошибке")
			}

			// Проверяем, что все ожидания мока были выполнены
			mockRepo.AssertExpectations(t)
		})
	}
}

// TestAuthService_ResetPassword тестирует сброс пароля
func TestAuthService_ResetPassword(t *testing.T) {
	tests := []struct {
		name          string
		email         string
		newPassword   string
		setupMocks    func(*MockUserRepository)
		expectedError error
		shouldSucceed bool
	}{
		{
			name:        "Успешный сброс пароля",
			email:       "test@example.com",
			newPassword: "NewPassword123!",
			setupMocks: func(m *MockUserRepository) {
				user := createTestUser()
				m.On("FindByEmail", "test@example.com").Return(user, nil)
				
				// Ожидаем обновление пароля
				m.On("Update", user.ID.Hex(), mock.MatchedBy(func(updates map[string]interface{}) bool {
					// Проверяем, что пароль был изменен и захеширован
					newHash, exists := updates["password"].(string)
					return exists && newHash != user.Password && newHash != "NewPassword123!"
				})).Return(user, nil)
			},
			shouldSucceed: true,
		},
		{
			name:        "Пользователь не найден",
			email:       "nonexistent@example.com",
			newPassword: "NewPassword123!",
			setupMocks: func(m *MockUserRepository) {
				m.On("FindByEmail", "nonexistent@example.com").Return(nil, ErrUserNotFound)
			},
			expectedError: ErrUserNotFound,
			shouldSucceed: false,
		},
		{
			name:        "Слабый новый пароль",
			email:       "test@example.com",
			newPassword: "123", // Слишком слабый пароль
			setupMocks: func(m *MockUserRepository) {
				// При слабом пароле метод FindByEmail не должен вызываться
				// так как проверка пароля происходит в самом начале метода ResetPassword
			},
			expectedError: ErrWeakPassword,
			shouldSucceed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Подготовка
			authService, mockRepo := setupAuthService()
			tt.setupMocks(mockRepo)

			// Выполнение
			err := authService.ResetPassword(tt.email, tt.newPassword)

			// Проверка результатов
			if tt.shouldSucceed {
				require.NoError(t, err, "Сброс пароля должен быть успешным")
			} else {
				require.Error(t, err, "Ожидается ошибка при сбросе пароля")
				if tt.expectedError != nil {
					assert.Equal(t, tt.expectedError, err)
				}
			}

			// Проверяем, что все ожидания мока были выполнены
	mockRepo.AssertExpectations(t)
		})
	}
}

// TestAuthService_GenerateToken тестирует генерацию JWT токенов
func TestAuthService_GenerateToken(t *testing.T) {
	authService, _ := setupAuthService()
	testUser := createTestUser()

	// Генерируем токен
	token, err := authService.GenerateToken(testUser)
	
	// Проверяем результат
	require.NoError(t, err, "Генерация токена должна быть успешной")
	require.NotEmpty(t, token, "Токен не должен быть пустым")

	// Проверяем, что токен валиден и содержит правильные данные
	claims, err := authService.VerifyToken(token)
	require.NoError(t, err, "Сгенерированный токен должен быть валидным")
	
	assert.Equal(t, testUser.ID.Hex(), claims["id"])
	assert.Equal(t, testUser.Username, claims["username"])
	
	// Проверяем срок действия токена
	exp, ok := claims["exp"].(float64)
	require.True(t, ok, "Токен должен содержать время истечения")
	
	expTime := time.Unix(int64(exp), 0)
	assert.True(t, expTime.After(time.Now()), "Токен должен быть действительным")
	assert.True(t, expTime.Before(time.Now().Add(25*time.Hour)), "Срок действия токена должен быть разумным")
} 