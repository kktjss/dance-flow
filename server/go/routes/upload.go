package routes

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
)

// Регистрирует все маршруты загрузки
func RegisterUploadRoutes(router *gin.RouterGroup, cfg *config.Config) {
	uploads := router.Group("/upload")
	uploads.Use(middleware.JWTMiddleware(cfg))
	{
		uploads.POST("/video", uploadVideo)
		uploads.POST("", uploadFile) // Общий маршрут для загрузки файлов (аудио и других)
	}
}

// uploadVideo обрабатывает загрузку видео файлов
func uploadVideo(c *gin.Context) {
	// Проверяем существует ли директория загрузок, если нет - создаем её
	uploadDir := "uploads/videos"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Получаем файл из запроса
	file, header, err := c.Request.FormFile("video")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Проверяем тип файла
	filename := header.Filename
	ext := strings.ToLower(filepath.Ext(filename))
	allowedExts := map[string]bool{
		".mp4": true,
		".mov": true,
		".avi": true,
		".wmv": true,
		".mkv": true,
	}

	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Allowed types: mp4, mov, avi, wmv, mkv"})
		return
	}

	// Создаем уникальное имя файла используя временную метку
	newFilename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, newFilename)

	// Создаем файл на сервере
	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}
	defer out.Close()

	// Копируем данные файла в новый файл
	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Возвращаем URL файла
	fileURL := "/uploads/videos/" + newFilename
	c.JSON(http.StatusOK, gin.H{
		"url":      fileURL,
		"filename": newFilename,
		"success":  true,
	})
}

// uploadFile обрабатывает общую загрузку файлов, включая аудио
func uploadFile(c *gin.Context) {
	// Получаем файл из запроса
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Определяем тип файла и директорию
	filename := header.Filename
	ext := strings.ToLower(filepath.Ext(filename))
	
	// Проверяем тип файла и устанавливаем директорию загрузки
	var uploadDir string
	var allowedExts map[string]bool
	
	// Проверяем, является ли это аудио файлом
	audioExts := map[string]bool{
		".mp3": true,
		".wav": true,
		".ogg": true,
		".aac": true,
		".flac": true,
		".m4a": true,
	}
	
	if audioExts[ext] {
		uploadDir = "uploads/audio"
		allowedExts = audioExts
	} else {
		// Для других типов файлов
		uploadDir = "uploads/files"
		// Разрешаем все расширения для общих файлов
		allowedExts = map[string]bool{ext: true}
	}
	
	// Создаем директорию, если она не существует
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}
	
	// Проверяем тип файла
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type"})
		return
	}
	
	// Создаем уникальное имя файла используя временную метку
	newFilename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, newFilename)
	
	// Создаем файл на сервере
	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}
	defer out.Close()
	
	// Копируем данные файла в новый файл
	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	
	// Возвращаем URL файла
	fileURL := fmt.Sprintf("/%s/%s", uploadDir, newFilename)
	c.JSON(http.StatusOK, gin.H{
		"url":      fileURL,
		"filename": newFilename,
		"success":  true,
	})
} 