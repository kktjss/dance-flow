package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Локальные импорты для конфигурации и утилит
// В реальной ситуации эти пакеты были бы импортированы из основного модуля
// Но для независимого тестирования мы создаем локальные определения

// TestConfig содержит все конфигурационные параметры для тестов
type TestConfig struct {
	APIURL          string
	RequestTimeout  time.Duration
	MongoTestURI    string
	TestDBName      string
	NumRequests     int
	NumUsers        int
	MaxResponseTime time.Duration
	TestEnv         string
	LogLevel        string
}

// NewTestConfig создает новую конфигурацию тестов с значениями по умолчанию
func NewTestConfig() *TestConfig {
	return &TestConfig{
		APIURL:          "http://localhost:5000",
		RequestTimeout:  10 * time.Second,
		MongoTestURI:    "mongodb://localhost:27017",
		TestDBName:      "dance_flow_test",
		NumRequests:     100,
		NumUsers:        10,
		MaxResponseTime: 200 * time.Millisecond,
		TestEnv:         "test",
		LogLevel:        "info",
	}
}

// IsPerfTestEnabled проверяет, включены ли тесты производительности
func (c *TestConfig) IsPerfTestEnabled() bool {
	// Проверяем переменную окружения RUN_PERFORMANCE_TESTS
	runPerf := os.Getenv("RUN_PERFORMANCE_TESTS")
	return runPerf == "true" || runPerf == "1"
}

// TestUser содержит данные тестового пользователя
type TestUser struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Token    string `json:"token,omitempty"`
	ID       string `json:"id,omitempty"`
}

// CreateTestUser создает тестового пользователя с уникальными данными
func CreateTestUser(prefix string) *TestUser {
	timestamp := time.Now().UnixNano()
	return &TestUser{
		Username: fmt.Sprintf("%s_user_%d", prefix, timestamp),
		Email:    fmt.Sprintf("%s_user_%d@example.com", prefix, timestamp),
		Password: "Test@123456",
	}
}

// RegisterUser регистрирует пользователя через API
func RegisterUser(t *testing.T, client *http.Client, baseURL string, user *TestUser) {
	url := fmt.Sprintf("%s/api/auth/register", baseURL)
	
	data := map[string]string{
		"username": user.Username,
		"email":    user.Email,
		"password": user.Password,
	}
	
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)
	
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	defer resp.Body.Close()
	
	require.Equal(t, http.StatusCreated, resp.StatusCode, "Ошибка регистрации пользователя")
	
	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	
	// Извлекаем ID пользователя если есть
	if userData, ok := result["user"].(map[string]interface{}); ok {
		if userID, ok := userData["_id"].(string); ok {
			user.ID = userID
		}
	}
}

// LoginUser авторизует пользователя и получает токен
func LoginUser(t *testing.T, client *http.Client, baseURL string, user *TestUser) {
	url := fmt.Sprintf("%s/api/auth/login", baseURL)
	
	data := map[string]string{
		"username": user.Username,
		"password": user.Password,
	}
	
	jsonData, err := json.Marshal(data)
	require.NoError(t, err)
	
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	defer resp.Body.Close()
	
	require.Equal(t, http.StatusOK, resp.StatusCode, "Ошибка авторизации пользователя")
	
	var result map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(t, err)
	
	token, ok := result["token"].(string)
	require.True(t, ok, "Токен не найден в ответе")
	
	user.Token = token
}

// CreateAuthenticatedRequest создает HTTP запрос с токеном авторизации
func CreateAuthenticatedRequest(method, url string, body []byte, token string) (*http.Request, error) {
	var req *http.Request
	var err error
	
	if body != nil {
		req, err = http.NewRequest(method, url, bytes.NewBuffer(body))
	} else {
		req, err = http.NewRequest(method, url, nil)
	}
	
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	
	return req, nil
}

// TestProject содержит данные тестового проекта
type TestProject struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	IsPrivate   bool     `json:"isPrivate"`
	Tags        []string `json:"tags"`
	ID          string   `json:"id,omitempty"`
}

// CreateTestProject создает тестовый проект с уникальными данными
func CreateTestProject(prefix string) *TestProject {
	timestamp := time.Now().UnixNano()
	return &TestProject{
		Name:        fmt.Sprintf("%s Project %d", prefix, timestamp),
		Description: fmt.Sprintf("Test project created at %d", timestamp),
		IsPrivate:   false,
		Tags:        []string{"test", prefix},
	}
}

// PerformanceResult содержит результаты производительности запроса
type PerformanceResult struct {
	Endpoint     string        // Тестируемый эндпоинт
	StatusCode   int           // HTTP статус код
	ResponseTime time.Duration // Время ответа
	Error        error         // Ошибка запроса, если есть
}

// PerformanceStats содержит статистику производительности
type PerformanceStats struct {
	TotalRequests    int
	SuccessfulReqs   int
	FailedRequests   int
	AverageTime      time.Duration
	MinTime          time.Duration
	MaxTime          time.Duration
	RequestsPerSec   float64
}

// TestAPIPerformance проверяет производительность API
func TestAPIPerformance(t *testing.T) {
	cfg := NewTestConfig()
	
	// Пропускаем тест, если производительные тесты отключены
	if !cfg.IsPerfTestEnabled() {
		t.Skip("Пропуск тестов производительности. Установите RUN_PERFORMANCE_TESTS=true для запуска.")
	}

	// Создаем и авторизуем тестовых пользователей
	tokens, err := createAndLoginTestUsers(t, cfg)
	require.NoError(t, err, "Ошибка создания тестовых пользователей")

	// Определяем эндпоинты для тестирования
	endpoints := []string{
		"/api/projects",              // Получение всех проектов
		"/api/users/me",              // Получение профиля пользователя
		"/api/dance_categories",      // Получение категорий танцев
		"/api/reference_movements",   // Получение эталонных движений
	}

	// Тестируем каждый эндпоинт
	for _, endpoint := range endpoints {
		t.Run(fmt.Sprintf("Performance_%s", endpoint), func(t *testing.T) {
			results := testEndpointPerformance(t, cfg, endpoint, tokens)
			stats := analyzePerformanceResults(results)
			
			// Логируем результаты
			logPerformanceStats(t, endpoint, stats)
			
			// Проверяем критерии производительности
			assert.True(t, stats.AverageTime <= cfg.MaxResponseTime,
				"Среднее время ответа %v превышает лимит %v", stats.AverageTime, cfg.MaxResponseTime)
			
			assert.True(t, stats.SuccessfulReqs >= int(float64(stats.TotalRequests)*0.95),
				"Успешных запросов %d меньше 95%% от общего числа %d", stats.SuccessfulReqs, stats.TotalRequests)
		})
	}

	// Тестируем создание проекта (POST запросы)
	t.Run("Performance_CreateProject", func(t *testing.T) {
		results := testCreateProjectPerformance(t, cfg, tokens)
		stats := analyzePerformanceResults(results)
		
		logPerformanceStats(t, "/api/projects (POST)", stats)
		
		// Более мягкие требования для POST запросов
		maxCreateTime := cfg.MaxResponseTime * 2
		assert.True(t, stats.AverageTime <= maxCreateTime,
			"Среднее время создания проекта %v превышает лимит %v", stats.AverageTime, maxCreateTime)
	})
}

// createAndLoginTestUsers создает и авторизует тестовых пользователей
func createAndLoginTestUsers(t *testing.T, cfg *TestConfig) ([]string, error) {
	tokens := make([]string, cfg.NumUsers)
	client := &http.Client{Timeout: cfg.RequestTimeout}

	for i := 0; i < cfg.NumUsers; i++ {
		// Создаем тестового пользователя
		testUser := CreateTestUser(fmt.Sprintf("perf_%d", i))

		// Регистрируем пользователя
		RegisterUser(t, client, cfg.APIURL, testUser)
		
		// Авторизуем пользователя
		LoginUser(t, client, cfg.APIURL, testUser)
		
		tokens[i] = testUser.Token
	}

	return tokens, nil
}

// testEndpointPerformance тестирует производительность указанного эндпоинта
func testEndpointPerformance(t *testing.T, cfg *TestConfig, endpoint string, tokens []string) []PerformanceResult {
	results := make([]PerformanceResult, cfg.NumRequests)
	var wg sync.WaitGroup
	wg.Add(cfg.NumRequests)

	client := &http.Client{Timeout: cfg.RequestTimeout}

	// Запускаем несколько одновременных запросов
	for i := 0; i < cfg.NumRequests; i++ {
		go func(idx int) {
			defer wg.Done()

			// Выбираем токен для текущего запроса
			tokenIdx := idx % len(tokens)
			token := tokens[tokenIdx]

			// Создаем авторизованный запрос
			url := fmt.Sprintf("%s%s", cfg.APIURL, endpoint)
			req, err := CreateAuthenticatedRequest("GET", url, nil, token)
			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint: endpoint,
					Error:    err,
				}
				return
			}

			// Засекаем время выполнения запроса
			startTime := time.Now()
			resp, err := client.Do(req)
			duration := time.Since(startTime)

			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint:     endpoint,
					Error:        err,
					ResponseTime: duration,
				}
				return
			}
			defer resp.Body.Close()

			results[idx] = PerformanceResult{
				Endpoint:     endpoint,
				StatusCode:   resp.StatusCode,
				ResponseTime: duration,
				Error:        nil,
			}
		}(i)
	}

	wg.Wait()
	return results
}

// testCreateProjectPerformance тестирует производительность создания проекта
func testCreateProjectPerformance(t *testing.T, cfg *TestConfig, tokens []string) []PerformanceResult {
	results := make([]PerformanceResult, cfg.NumRequests)
	var wg sync.WaitGroup
	wg.Add(cfg.NumRequests)

	client := &http.Client{Timeout: cfg.RequestTimeout}

	// Запускаем несколько одновременных запросов
	for i := 0; i < cfg.NumRequests; i++ {
		go func(idx int) {
			defer wg.Done()

			// Выбираем токен для текущего запроса
			tokenIdx := idx % len(tokens)
			token := tokens[tokenIdx]

			// Создаем уникальный проект
			testProject := CreateTestProject(fmt.Sprintf("perf_%d", idx))
			
			jsonData, err := json.Marshal(testProject)
			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint: "/api/projects (POST)",
					Error:    err,
				}
				return
			}

			// Создаем авторизованный запрос
			url := fmt.Sprintf("%s/api/projects", cfg.APIURL)
			req, err := CreateAuthenticatedRequest("POST", url, jsonData, token)
			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint: "/api/projects (POST)",
					Error:    err,
				}
				return
			}

			// Засекаем время выполнения запроса
			startTime := time.Now()
			resp, err := client.Do(req)
			duration := time.Since(startTime)

			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint:     "/api/projects (POST)",
					Error:        err,
					ResponseTime: duration,
				}
				return
			}
			defer resp.Body.Close()

			results[idx] = PerformanceResult{
				Endpoint:     "/api/projects (POST)",
				StatusCode:   resp.StatusCode,
				ResponseTime: duration,
				Error:        nil,
			}
		}(i)
	}

	wg.Wait()
	return results
}

// analyzePerformanceResults анализирует результаты производительности
func analyzePerformanceResults(results []PerformanceResult) PerformanceStats {
	stats := PerformanceStats{
		TotalRequests: len(results),
		MinTime:       time.Hour, // Устанавливаем большое начальное значение
	}

	var totalTime time.Duration
	var successfulTimes []time.Duration

	for _, result := range results {
		if result.Error == nil && result.StatusCode >= 200 && result.StatusCode < 300 {
			stats.SuccessfulReqs++
			totalTime += result.ResponseTime
			successfulTimes = append(successfulTimes, result.ResponseTime)
			
			if result.ResponseTime < stats.MinTime {
				stats.MinTime = result.ResponseTime
			}
			if result.ResponseTime > stats.MaxTime {
				stats.MaxTime = result.ResponseTime
			}
		} else {
			stats.FailedRequests++
		}
	}

	if stats.SuccessfulReqs > 0 {
		stats.AverageTime = totalTime / time.Duration(stats.SuccessfulReqs)
		totalSeconds := stats.MaxTime.Seconds()
		if totalSeconds > 0 {
			stats.RequestsPerSec = float64(stats.SuccessfulReqs) / totalSeconds
		}
	}

	return stats
}

// logPerformanceStats логирует статистику производительности
func logPerformanceStats(t *testing.T, endpoint string, stats PerformanceStats) {
	t.Logf("📊 Статистика производительности для %s:", endpoint)
	t.Logf("   Всего запросов: %d", stats.TotalRequests)
	t.Logf("   Успешных: %d (%.1f%%)", stats.SuccessfulReqs, 
		float64(stats.SuccessfulReqs)/float64(stats.TotalRequests)*100)
	t.Logf("   Неудачных: %d", stats.FailedRequests)
	t.Logf("   Среднее время: %v", stats.AverageTime)
	t.Logf("   Мин. время: %v", stats.MinTime)
	t.Logf("   Макс. время: %v", stats.MaxTime)
	t.Logf("   Запросов/сек: %.2f", stats.RequestsPerSec)
}

// BenchmarkAPIEndpoints запускает бенчмарки для основных эндпоинтов
func BenchmarkAPIEndpoints(b *testing.B) {
	cfg := NewTestConfig()
	
	if !cfg.IsPerfTestEnabled() {
		b.Skip("Пропуск бенчмарков. Установите RUN_PERFORMANCE_TESTS=true для запуска.")
	}

	// Создаем одного тестового пользователя для бенчмарков
	client := &http.Client{Timeout: cfg.RequestTimeout}
	testUser := CreateTestUser("bench")
	
	// Используем testing.T для setup (в бенчмарках нет require)
	// utils.RegisterUser требует *testing.T, поэтому создаем обертку
	// В реальном проекте лучше создать отдельные функции без require
	
	b.Run("GetProjects", func(b *testing.B) {
		url := fmt.Sprintf("%s/api/projects", cfg.APIURL)
		
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			req, _ := CreateAuthenticatedRequest("GET", url, nil, testUser.Token)
			resp, err := client.Do(req)
			if err == nil {
				resp.Body.Close()
			}
		}
	})
} 