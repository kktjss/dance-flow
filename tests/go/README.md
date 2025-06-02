# Тестирование Go Backend

Этот каталог содержит все тесты для Go backend части проекта Dance Flow.

## 📁 Структура

```
tests/go/
├── config/           # Конфигурация тестов
├── utils/            # Утилиты для тестов
├── mocks/            # Моки для зависимостей
├── unit/             # Unit тесты
├── integration/      # Интеграционные тесты
├── e2e/              # End-to-end тесты
├── separate/         # Отдельные тесты (отдельный модуль)
├── tmp/              # Временные файлы
├── run_tests.sh      # Основной скрипт запуска
├── fix_imports.sh    # Утилита для исправления импортов
└── README.md         # Эта документация
```

## 🚀 Быстрый старт

### Запуск всех тестов

```bash
./run_tests.sh
```

### Запуск определенного типа тестов

```bash
./run_tests.sh unit           # Только unit тесты
./run_tests.sh integration    # Только интеграционные тесты
./run_tests.sh e2e            # Только E2E тесты
./run_tests.sh performance    # Только тесты производительности
```

### Запуск с дополнительными опциями

```bash
./run_tests.sh unit -v -c     # Unit тесты с подробным выводом и покрытием
./run_tests.sh all -r         # Все тесты с детекцией гонок
./run_tests.sh integration -b # Интеграционные тесты с бенчмарками
```

## 🧪 Прямые команды Go

Поскольку модуль разбит на независимые части, вы также можете запускать тесты напрямую через команды Go:

### Основные тесты (в главном модуле)

```bash
# Все основные тесты
cd tests/go && go test ./...

# Unit и E2E тесты
cd tests/go && go test ./unit ./e2e -v

# Только unit тесты 
cd tests/go && go test ./unit -v

# Только E2E тесты
cd tests/go && go test ./e2e -v

# Integration тесты (только CRUD, без производительности)
cd tests/go && go test ./integration -v -run "^TestUserCRUD|^TestProjectCRUD"

# Integration тесты производительности
cd tests/go && go test ./integration -v -run "TestAPIPerformance"
```

### Отдельный модуль (separate)

```bash
# Тесты из отдельного модуля (сначала обновите зависимости)
cd tests/go/separate && go mod tidy && go test -v

# Конкретный тест
cd tests/go/separate && go test -v -run "TestSpecialOperations"

# Тесты контроллера проектов  
cd tests/go/separate && go test -v -run "TestProjectController"
```

### Последовательный запуск всех тестов

```bash
# Все тесты одной командой
cd tests/go && go test ./unit ./e2e -v && go test ./integration -v -run "^TestUserCRUD|^TestProjectCRUD" && cd separate && go test -v
```

### С покрытием кода

```bash
# Unit тесты с покрытием
cd tests/go && go test ./unit -v -cover

# Генерация HTML отчета
cd tests/go && go test ./unit -coverprofile=coverage.out && go tool cover -html=coverage.out -o coverage.html
```

### Отладка и дополнительные опции

```bash
# Запуск конкретного теста
cd tests/go && go test ./unit -v -run "TestAuthService_Register"

# С детекцией гонок
cd tests/go && go test ./unit -race -v

# С таймаутом
cd tests/go && go test ./unit -timeout 30s -v

# Короткие тесты (пропуск длительных)
cd tests/go && go test ./unit -short -v
```

### Важные примечания

- **Отдельный модуль**: Каталог `separate/` имеет свой собственный `go.mod` и должен запускаться отдельно
- **Integration тесты**: Тесты производительности требуют запущенного API сервера на `http://localhost:5000`
  - Если API не запущен, интеграционные тесты будут падать с ошибками подключения
  - Используйте `./run_tests.sh unit e2e separate` чтобы пропустить integration тесты
- **База данных**: Integration тесты требуют доступа к MongoDB на `mongodb://localhost:27017`
- **Переменные окружения**: Некоторые тесты используют переменные окружения для конфигурации

## 📋 Типы тестов

### Unit тесты (`unit/`)

Тестируют отдельные компоненты в изоляции с использованием моков.

**Примеры:**
- `auth_service_test.go` - Тесты сервиса аутентификации
- Тесты контроллеров, сервисов, утилит

**Особенности:**
- Используют моки для зависимостей
- Быстро выполняются
- Не требуют внешних ресурсов

### Интеграционные тесты (`integration/`)

Тестируют взаимодействие между компонентами с реальными зависимостями.

**Примеры:**
- `database_test.go` - Тесты работы с MongoDB
- `performance_test.go` - Тесты производительности

**Особенности:**
- Используют реальную тестовую БД
- Проверяют производительность
- Требуют настройки окружения

### E2E тесты (`e2e/`)

Тестируют полные пользовательские сценарии через API.

**Примеры:**
- `api_test.go` - Полные сценарии работы с API

**Особенности:**
- Тестируют весь стек приложения
- Используют HTTP запросы
- Проверяют реальные пользовательские сценарии

### Отдельные тесты (`separate/`)

Специальные тесты, которые нужно запускать отдельно.

## 🔧 Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|-----------|----------|--------------|
| `MONGO_TEST_URI` | URI для тестовой MongoDB | `mongodb://localhost:27017` |
| `TEST_API_URL` | URL для тестирования API | `http://localhost:5000` |
| `RUN_PERFORMANCE_TESTS` | Включить тесты производительности | `false` |
| `TEST_TIMEOUT` | Таймаут для тестов | `10m` |
| `TEST_ENV` | Среда тестирования | `test` |

### Пример настройки

```bash
export MONGO_TEST_URI="mongodb://localhost:27017"
export TEST_API_URL="http://localhost:5000"
export RUN_PERFORMANCE_TESTS="true"
./run_tests.sh
```

## 🏗️ Архитектура тестов

### Моки (`mocks/`)

Централизованные моки для всех зависимостей:

```go
// Пример использования мока
func TestSomeFunction(t *testing.T) {
    mockRepo := mocks.NewMockUserRepository()
    mockRepo.On("FindByID", "123").Return(user, nil)
    
    service := NewService(mockRepo)
    result, err := service.GetUser("123")
    
    assert.NoError(t, err)
    mockRepo.AssertExpectations(t)
}
```

### Утилиты (`utils/`)

Общие функции для всех тестов:

```go
// Создание тестового пользователя
user := utils.CreateTestUser("test")

// Подключение к тестовой БД
client, db, err := utils.SetupTestMongoDB(uri, dbName)

// Создание авторизованного запроса
req, err := utils.CreateAuthenticatedRequest("GET", url, nil, token)
```

### Конфигурация (`config/`)

Централизованная конфигурация:

```go
cfg := config.NewTestConfig()
// Автоматически загружает настройки из переменных окружения
```

## 📊 Покрытие кода

### Генерация отчета покрытия

```bash
./run_tests.sh all -c
```

Это создаст:
- `coverage.out` - данные покрытия
- `coverage.html` - HTML отчет

### Просмотр отчета

```bash
open coverage.html
```

## 🏃‍♂️ Производительность

### Запуск тестов производительности

```bash
export RUN_PERFORMANCE_TESTS=true
./run_tests.sh performance
```

### Настройка параметров

```bash
export PERF_NUM_REQUESTS=200      # Количество запросов
export PERF_NUM_USERS=20          # Количество пользователей
export PERF_MAX_RESPONSE_TIME=500ms # Максимальное время ответа
```

### Бенчмарки

```bash
./run_tests.sh integration -b
```

## 🛠️ Разработка тестов

### Создание нового unit теста

1. Создайте файл в `unit/` с суффиксом `_test.go`
2. Используйте table-driven тесты:

```go
func TestSomeFunction(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        expected string
        wantErr  bool
    }{
        {"Успешный случай", "input", "output", false},
        {"Ошибка", "bad", "", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result, err := SomeFunction(tt.input)
            
            if tt.wantErr {
                require.Error(t, err)
            } else {
                require.NoError(t, err)
                assert.Equal(t, tt.expected, result)
            }
        })
    }
}
```

### Создание нового мока

1. Создайте файл в `mocks/` с интерфейсом:

```go
package mocks

import "github.com/stretchr/testify/mock"

type MockService struct {
    mock.Mock
}

func (m *MockService) SomeMethod(param string) (string, error) {
    args := m.Called(param)
    return args.String(0), args.Error(1)
}

func NewMockService() *MockService {
    return &MockService{}
}
```

## 🐛 Отладка

### Запуск отдельного теста

```bash
go test -v ./unit -run TestSpecificFunction
```

### Детекция гонок

```bash
./run_tests.sh unit -r
```

### Подробный вывод

```bash
./run_tests.sh unit -v
```

## ✅ Best Practices

1. **Именование тестов**: Используйте описательные имена на русском языке
2. **Table-driven тесты**: Предпочитайте табличные тесты для множественных сценариев
3. **Моки**: Всегда проверяйте `AssertExpectations(t)` после использования моков
4. **Cleanup**: Очищайте ресурсы в `defer` или `t.Cleanup()`
5. **Изоляция**: Каждый тест должен быть независимым
6. **Комментарии**: Пишите комментарии на русском языке

## 🔍 Устранение проблем

### MongoDB недоступна

```bash
# Запуск MongoDB через Docker
docker run -d -p 27017:27017 mongo:latest
```

### Порт API занят

```bash
# Измените порт в переменной окружения
export TEST_API_URL="http://localhost:8080"
```

### Проблемы с модулями

```bash
go mod tidy
go mod download
```

## 📈 Метрики и мониторинг

Тесты автоматически собирают метрики:
- Время выполнения тестов
- Покрытие кода
- Производительность API
- Статистика успешности

Результаты сохраняются в лог файлы и могут быть интегрированы с CI/CD системами.

### Быстрый запуск без API

Если у вас не запущен API сервер, используйте:

```bash
# Запуск только тестов, не требующих API
./run_tests.sh unit
./run_tests.sh e2e  
./run_tests.sh separate

# Или все сразу без integration тестов (нужно будет запускать отдельно)
cd tests/go && go test ./unit/... ./e2e/... && cd separate && go test .
```