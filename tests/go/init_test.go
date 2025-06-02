package main

import (
	"fmt"
	"os"
	"testing"
)

// TestMain выполняется один раз перед всеми тестами в пакете
// Здесь можно настроить общую среду тестирования и очистить ресурсы после завершения
func TestMain(m *testing.M) {
	// Инициализация тестовой среды
	fmt.Println("🚀 Инициализация тестовой среды...")
	
	// Можно добавить общую настройку для всех тестов
	setupGlobalTestEnvironment()
	
	// Запускаем все тесты
	code := m.Run()
	
	// Очистка ресурсов после завершения всех тестов
	fmt.Println("🧹 Очистка тестовой среды...")
	cleanupGlobalTestEnvironment()
	
	os.Exit(code)
}

// setupGlobalTestEnvironment настраивает глобальную среду для тестов
func setupGlobalTestEnvironment() {
	// Установка переменных окружения для тестов
	if os.Getenv("TEST_ENV") == "" {
		os.Setenv("TEST_ENV", "true")
	}
	
	// Можно добавить другие глобальные настройки
	fmt.Println("✅ Глобальная среда тестирования настроена")
}

// cleanupGlobalTestEnvironment очищает ресурсы после тестов
func cleanupGlobalTestEnvironment() {
	// Очистка глобальных ресурсов, если необходимо
	fmt.Println("✅ Глобальная очистка завершена")
} 