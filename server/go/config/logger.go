package config

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

var (
	// Logger является глобальным экземпляром логгера
	Logger *log.Logger
	// LogFile является обработчиком файла для логирования
	LogFile *os.File
)

// InitLogger инициализирует систему файлового логирования
func InitLogger() error {
	// Создаем директорию для логов, если она не существует
	logsDir := "./logs"
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return fmt.Errorf("не удалось создать директорию для логов: %w", err)
	}

	// Создаем файл лога с временной меткой в имени
	timestamp := time.Now().Format("2006-01-02")
	logFilePath := filepath.Join(logsDir, fmt.Sprintf("server-%s.log", timestamp))
	
	// Открываем файл лога в режиме добавления
	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("не удалось открыть файл лога: %w", err)
	}
	
	// Создаем мульти-писатель для записи как в консоль, так и в файл
	multiWriter := io.MultiWriter(os.Stdout, file)
	
	// Устанавливаем вывод лога в наш мульти-писатель
	Logger = log.New(multiWriter, "", log.LstdFlags|log.Lshortfile)
	
	// Сохраняем дескриптор файла для последующего закрытия
	LogFile = file
	
	Logger.Printf("Логгер инициализирован, запись в %s\n", logFilePath)
	return nil
}

// CloseLogger закрывает файл лога
func CloseLogger() {
	if LogFile != nil {
		Logger.Println("Закрытие логгера")
		LogFile.Close()
	}
}

// Log форматирует и записывает сообщение с временным префиксом
func Log(tag, format string, v ...interface{}) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	message := fmt.Sprintf(format, v...)
	Logger.Printf("[%s] [%s] %s", timestamp, tag, message)
}

// LogError записывает ошибку с временным префиксом
func LogError(tag string, err error) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	Logger.Printf("[%s] [%s] ОШИБКА: %v", timestamp, tag, err)
}

// LogRequest записывает HTTP запрос
func LogRequest(method, path, clientIP string, statusCode int, duration time.Duration) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	Logger.Printf("[%s] [REQ] %s %s - %s - %d (%s)", 
		timestamp, method, path, clientIP, statusCode, duration)
} 