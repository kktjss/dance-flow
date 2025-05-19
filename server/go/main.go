package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/routes"
)

func main() {
	// Загрузка конфигурации
	log.Println("Loading configuration...")
	cfg := config.Load()

	// Инициализация логгера
	log.Println("Initializing logger...")
	if err := config.InitLogger(); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer config.CloseLogger()

	// Подключение к MongoDB
	log.Println("Connecting to MongoDB...")
	err := config.Connect(cfg.MongoURI)
	if err != nil {
		config.LogError("MAIN", fmt.Errorf("failed to connect to MongoDB: %w", err))
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	log.Println("Successfully connected to MongoDB!")
	defer config.Close()

	// Создание роутера
	log.Println("Setting up HTTP router...")
	router := gin.Default()

	// Настройка CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Добавление промежуточного ПО для логирования
	router.Use(func(c *gin.Context) {
		// Запуск таймера
		start := time.Now()

		// Обработка запроса
		c.Next()

		// Логирование запроса в консоль и файл
		duration := time.Since(start)
		log.Printf("[%s] %s %s %d %s", 
			c.Request.Method, 
			c.Request.URL.Path, 
			c.ClientIP(), 
			c.Writer.Status(),
			duration.String())
			
		config.LogRequest(
			c.Request.Method,
			c.Request.URL.Path,
			c.ClientIP(),
			c.Writer.Status(),
			duration,
		)
	})

	// Добавление специального обработчика для файлов моделей для обеспечения правильного типа контента
	// Это должно быть ДО StaticFS, чтобы избежать конфликтов с маршрутами подстановки
	router.GET("/models/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filepath := fmt.Sprintf("./uploads/models/%s", filename)
		
		// Логирование запроса
		log.Printf("Serving model file: %s", filepath)
		
		// Проверка существования файла
		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			log.Printf("Model file not found: %s", filepath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Model file not found"})
			return
		}
		
		// Установка соответствующих заголовков
		c.Header("Content-Type", "model/gltf-binary")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Отправка файла
		c.File(filepath)
	})

	// Добавление специальных обработчиков для медиафайлов
	router.GET("/files/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filepath := fmt.Sprintf("./uploads/files/%s", filename)
		
		// Логирование запроса
		log.Printf("Serving file: %s", filepath)
		
		// Проверка существования файла
		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			log.Printf("File not found: %s", filepath)
			c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
			return
		}
		
		// Установка соответствующих заголовков для видео файлов
		c.Header("Content-Type", "video/mp4")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Range")
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Отправка файла
		c.File(filepath)
	})

	router.GET("/audio/:filename", func(c *gin.Context) {
		filename := c.Param("filename")
		filepath := fmt.Sprintf("./uploads/audio/%s", filename)
		
		// Логирование запроса
		log.Printf("Serving audio file: %s", filepath)
		
		// Проверка существования файла
		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			log.Printf("Audio file not found: %s", filepath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Audio file not found"})
			return
		}
		
		// Установка соответствующих заголовков для аудио файлов
		c.Header("Content-Type", "audio/mpeg")
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Range")
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Отправка файла
		c.File(filepath)
	})
	
	// Обслуживание статических файлов из директории uploads с соответствующими заголовками
	router.StaticFS("/uploads", http.Dir("./uploads"))
	
	// Добавление прямого доступа к файлам через путь /files
	router.StaticFS("/files", http.Dir("./uploads/files"))
	
	// Добавление прямого доступа к аудио файлам через путь /audio
	router.StaticFS("/audio", http.Dir("./uploads/audio"))
	
	// Эндпоинт проверки работоспособности
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ok",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	})

	// Создание группы API
	api := router.Group("/api")

	// Регистрация маршрутов
	log.Println("Registering API routes...")
	routes.RegisterAuthRoutes(api, cfg)
	routes.RegisterProjectRoutes(api, cfg)
	routes.RegisterKeyframesRoutes(api, cfg)
	routes.RegisterUploadRoutes(api, cfg)
	
	// Регистрация новых маршрутов
	routes.RegisterHistoryRoutes(api, cfg)
	routes.RegisterDirectKeyframesRoutes(api, cfg)
	routes.RegisterTestRoutes(api, cfg)
	routes.RegisterTeamRoutes(api, cfg)
	routes.RegisterUserRoutes(api, cfg)
	routes.RegisterModelRoutes(api, cfg)
	
	log.Println("All routes registered successfully!")

	// Вывод текущей рабочей директории для отладки
	dir, _ := os.Getwd()
	log.Println("Current working directory:", dir)

	// Создание канала для прослушивания сигналов прерывания
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	// Запуск сервера в горутине
	go func() {
		addr := fmt.Sprintf(":%d", cfg.Port)
		config.Log("MAIN", "Server starting on %s", addr)
		log.Printf("Server starting on %s", addr)
		if err := router.Run(addr); err != nil && err != http.ErrServerClosed {
			config.LogError("MAIN", fmt.Errorf("failed to start server: %w", err))
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Ожидание сигнала прерывания
	<-stop
	config.Log("MAIN", "Shutting down server...")
	log.Println("Shutting down server...")

	// Здесь можно реализовать graceful shutdown при необходимости
	config.Log("MAIN", "Server stopped")
	log.Println("Server stopped")
} 