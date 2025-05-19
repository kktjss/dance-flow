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
	// Logger is the global logger instance
	Logger *log.Logger
	// LogFile is the file handler for logging
	LogFile *os.File
)

// InitLogger initializes the file logging system
func InitLogger() error {
	// Create logs directory if it doesn't exist
	logsDir := "./logs"
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return fmt.Errorf("failed to create logs directory: %w", err)
	}

	// Create log file with timestamp in name
	timestamp := time.Now().Format("2006-01-02")
	logFilePath := filepath.Join(logsDir, fmt.Sprintf("server-%s.log", timestamp))
	
	// Open log file with append mode
	file, err := os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}
	
	// Create a multi-writer to write to both console and file
	multiWriter := io.MultiWriter(os.Stdout, file)
	
	// Set the log output to our multi-writer
	Logger = log.New(multiWriter, "", log.LstdFlags|log.Lshortfile)
	
	// Store file handle for later closing
	LogFile = file
	
	Logger.Printf("Logger initialized, writing to %s\n", logFilePath)
	return nil
}

// CloseLogger closes the log file
func CloseLogger() {
	if LogFile != nil {
		Logger.Println("Closing logger")
		LogFile.Close()
	}
}

// Log formats and logs a message with timestamp prefix
func Log(tag, format string, v ...interface{}) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	message := fmt.Sprintf(format, v...)
	Logger.Printf("[%s] [%s] %s", timestamp, tag, message)
}

// LogError logs an error with timestamp prefix
func LogError(tag string, err error) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	Logger.Printf("[%s] [%s] ERROR: %v", timestamp, tag, err)
}

// LogRequest logs an HTTP request
func LogRequest(method, path, clientIP string, statusCode int, duration time.Duration) {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	Logger.Printf("[%s] [REQ] %s %s - %s - %d (%s)", 
		timestamp, method, path, clientIP, statusCode, duration)
} 