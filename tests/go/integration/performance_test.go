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
)

// Задаем параметры нагрузочного тестирования
const (
	BaseURL      = "http://localhost:5000" // Базовый URL тестируемого API
	NumRequests  = 100                     // Количество одновременных запросов
	NumUsers     = 10                      // Количество пользователей для тестов
	ResponseTime = 200                     // Максимальное время ответа в миллисекундах
)

// PerformanceResult содержит результаты производительности запроса
type PerformanceResult struct {
	Endpoint     string        // Тестируемый эндпоинт
	StatusCode   int           // HTTP статус код
	ResponseTime time.Duration // Время ответа
	Error        error         // Ошибка запроса, если есть
}

// TestAPIPerformance проверяет производительность API
func TestAPIPerformance(t *testing.T) {
	// Пропускаем тест, если мы не в режиме тестирования производительности
	if os.Getenv("RUN_PERFORMANCE_TESTS") != "true" {
		t.Skip("Skipping performance tests. Set RUN_PERFORMANCE_TESTS=true to run.")
	}

	// Создаем и авторизуем тестовых пользователей
	tokens, err := createAndLoginUsers(t, NumUsers)
	if err != nil {
		t.Fatalf("Failed to create test users: %v", err)
	}

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
			results := testEndpointPerformance(t, endpoint, tokens)
			analyzeResults(t, endpoint, results)
		})
	}

	// Тестируем создание проекта
	t.Run("Performance_CreateProject", func(t *testing.T) {
		results := testCreateProjectPerformance(t, tokens)
		analyzeResults(t, "/api/projects (POST)", results)
	})
}

// createAndLoginUsers создает и авторизует тестовых пользователей
func createAndLoginUsers(t *testing.T, numUsers int) ([]string, error) {
	tokens := make([]string, numUsers)

	for i := 0; i < numUsers; i++ {
		// Создаем уникальное имя пользователя
		username := fmt.Sprintf("perftest_user_%d_%d", i, time.Now().UnixNano())
		email := fmt.Sprintf("%s@example.com", username)
		password := "Test@123456"

		// Регистрируем пользователя
		registerURL := fmt.Sprintf("%s/api/auth/register", BaseURL)
		registerData := map[string]string{
			"username": username,
			"email":    email,
			"password": password,
		}
		jsonData, _ := json.Marshal(registerData)

		resp, err := http.Post(registerURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, fmt.Errorf("failed to register user: %v", err)
		}
		resp.Body.Close()

		// Логин пользователя
		loginURL := fmt.Sprintf("%s/api/auth/login", BaseURL)
		loginData := map[string]string{
			"username": username,
			"password": password,
		}
		jsonData, _ = json.Marshal(loginData)

		resp, err = http.Post(loginURL, "application/json", bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, fmt.Errorf("failed to login user: %v", err)
		}
		defer resp.Body.Close()

		// Получаем токен из ответа
		var loginResp map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&loginResp); err != nil {
			return nil, fmt.Errorf("failed to parse login response: %v", err)
		}

		token, ok := loginResp["token"].(string)
		if !ok {
			return nil, fmt.Errorf("invalid token format in response")
		}

		tokens[i] = token
	}

	return tokens, nil
}

// testEndpointPerformance тестирует производительность указанного эндпоинта
func testEndpointPerformance(t *testing.T, endpoint string, tokens []string) []PerformanceResult {
	results := make([]PerformanceResult, NumRequests)
	var wg sync.WaitGroup
	wg.Add(NumRequests)

	// Запускаем несколько одновременных запросов
	for i := 0; i < NumRequests; i++ {
		go func(idx int) {
			defer wg.Done()

			// Выбираем токен для текущего запроса
			tokenIdx := idx % len(tokens)
			token := tokens[tokenIdx]

			// Создаем запрос
			url := fmt.Sprintf("%s%s", BaseURL, endpoint)
			req, err := http.NewRequest("GET", url, nil)
			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint: endpoint,
					Error:    err,
				}
				return
			}

			// Добавляем заголовок авторизации
			req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", token))

			// Засекаем время выполнения запроса
			startTime := time.Now()
			client := &http.Client{}
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
func testCreateProjectPerformance(t *testing.T, tokens []string) []PerformanceResult {
	results := make([]PerformanceResult, NumRequests)
	var wg sync.WaitGroup
	wg.Add(NumRequests)

	// Запускаем несколько одновременных запросов
	for i := 0; i < NumRequests; i++ {
		go func(idx int) {
			defer wg.Done()

			// Выбираем токен для текущего запроса
			tokenIdx := idx % len(tokens)
			token := tokens[tokenIdx]

			// Создаем уникальное имя проекта
			projectName := fmt.Sprintf("Perf Test Project %d_%d", idx, time.Now().UnixNano())

			// Данные проекта
			projectData := map[string]interface{}{
				"name":        projectName,
				"description": "Project created during performance testing",
				"isPrivate":   false,
				"tags":        []string{"test", "performance"},
			}
			jsonData, _ := json.Marshal(projectData)

			// Создаем запрос
			url := fmt.Sprintf("%s/api/projects", BaseURL)
			req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
			if err != nil {
				results[idx] = PerformanceResult{
					Endpoint: "/api/projects (POST)",
					Error:    err,
				}
				return
			}

			// Добавляем заголовки
			req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", token))
			req.Header.Add("Content-Type", "application/json")

			// Засекаем время выполнения запроса
			startTime := time.Now()
			client := &http.Client{}
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

// analyzeResults анализирует результаты производительности
func analyzeResults(t *testing.T, endpoint string, results []PerformanceResult) {
	var (
		totalTime     time.Duration
		successCount  int
		failureCount  int
		max           time.Duration
		min           = time.Hour // Инициализируем с большим значением
		timeouts      int
		status200     int
		status400     int
		status500     int
		responsesByMS = make(map[int]int) // Гистограмма по времени ответа
	)

	// Анализируем результаты
	for _, result := range results {
		if result.Error != nil {
			failureCount++
			if os.IsTimeout(result.Error) {
				timeouts++
			}
		} else {
			successCount++
			totalTime += result.ResponseTime

			// Обновляем min и max
			if result.ResponseTime < min {
				min = result.ResponseTime
			}
			if result.ResponseTime > max {
				max = result.ResponseTime
			}

			// Классифицируем по статусу
			switch {
			case result.StatusCode >= 200 && result.StatusCode < 300:
				status200++
			case result.StatusCode >= 400 && result.StatusCode < 500:
				status400++
			case result.StatusCode >= 500:
				status500++
			}

			// Добавляем в гистограмму
			responsesByMS[int(result.ResponseTime.Milliseconds())/10*10]++
		}
	}

	// Вычисляем среднее время ответа
	var avgTime time.Duration
	if successCount > 0 {
		avgTime = totalTime / time.Duration(successCount)
	}

	// Выводим результаты
	t.Logf("Performance results for %s:", endpoint)
	t.Logf("  Total requests: %d", len(results))
	t.Logf("  Success rate: %.2f%% (%d/%d)", float64(successCount)/float64(len(results))*100, successCount, len(results))
	t.Logf("  Average response time: %v", avgTime)
	t.Logf("  Min response time: %v", min)
	t.Logf("  Max response time: %v", max)
	t.Logf("  Status codes: 2xx=%d, 4xx=%d, 5xx=%d", status200, status400, status500)
	t.Logf("  Timeouts: %d", timeouts)

	// Проверяем требования к производительности
	assert.GreaterOrEqual(t, float64(successCount)/float64(len(results))*100, 95.0, "Success rate should be at least 95%%")
	assert.LessOrEqual(t, avgTime, time.Duration(ResponseTime)*time.Millisecond, "Average response time should be less than %d ms", ResponseTime)
	assert.Equal(t, status500, 0, "There should be no 5xx errors")
} 