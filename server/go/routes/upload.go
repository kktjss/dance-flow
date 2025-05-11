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

// RegisterUploadRoutes registers all upload routes
func RegisterUploadRoutes(router *gin.RouterGroup, cfg *config.Config) {
	uploads := router.Group("/upload")
	uploads.Use(middleware.JWTMiddleware(cfg))
	{
		uploads.POST("/video", uploadVideo)
	}
}

// uploadVideo handles video file uploads
func uploadVideo(c *gin.Context) {
	// Check if the uploads directory exists, if not create it
	uploadDir := "uploads/videos"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Get the file from the request
	file, header, err := c.Request.FormFile("video")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Validate file type
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

	// Create a unique filename using timestamp
	newFilename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadDir, newFilename)

	// Create the file on the server
	out, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}
	defer out.Close()

	// Copy the file data to the new file
	_, err = io.Copy(out, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Return the file URL
	fileURL := "/uploads/videos/" + newFilename
	c.JSON(http.StatusOK, gin.H{
		"url":      fileURL,
		"filename": newFilename,
		"success":  true,
	})
} 