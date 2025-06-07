package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Регистрирует все маршруты проектов
func RegisterProjectRoutes(router *gin.RouterGroup, cfg *config.Config) {
	projects := router.Group("/projects")
	projects.Use(middleware.JWTMiddleware(cfg))
	{
		projects.GET("", getProjects)
		projects.POST("", createProject)
		projects.GET("/:id/debug", getProjectDebug)
		projects.POST("/:id/debug", postProjectDebug)
		projects.GET("/:id", getProject)
		projects.PUT("/:id", middleware.CheckProjectAccess(), updateProject)
		projects.DELETE("/:id", middleware.CheckProjectAccess(), deleteProject)
		
		// Регистрируем тестовый эндпоинт, который не проверяет членство в командах
		projects.GET("/test", getProjectsTest)
		router.GET("/projects-test", middleware.JWTMiddleware(cfg), getProjectsTest)
	}
}

// Возвращает все проекты, доступные аутентифицированному пользователю
func getProjects(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	log.Printf("[PROJECT] Fetching projects for user: %s", userID.Hex())

	// Получаем членство пользователя в командах для поиска проектов команд
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user data"})
		return
	}

	// Создаем список ID команд, в которых состоит пользователь
	var teamIDs []primitive.ObjectID
	for _, team := range user.Teams {
		teamIDs = append(teamIDs, team)
	}

	// Фильтр запроса: собственные проекты пользователя ИЛИ проекты из команд, в которых он состоит, ИЛИ публичные проекты
	filter := bson.M{
		"$or": []bson.M{
			{"owner": userID},
			{"isPrivate": false},
		},
	}

	// Добавляем проекты команд, если пользователь состоит в каких-либо командах
	if len(teamIDs) > 0 {
		filter["$or"] = append(filter["$or"].([]bson.M), bson.M{"teamId": bson.M{"$in": teamIDs}})
	}

	// Сначала получаем все подходящие проекты как сырые BSON документы
	findOptions := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.ProjectsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		log.Printf("[PROJECT] Error fetching projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get projects"})
		return
	}
	defer cursor.Close(ctx)

	// Обрабатываем каждый проект индивидуально для правильной обработки элементов
	var projects []models.Project
	var rawProjects []bson.M
	if err := cursor.All(ctx, &rawProjects); err != nil {
		log.Printf("[PROJECT] Error decoding projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	// Обрабатываем каждый сырой проект
	for _, rawProject := range rawProjects {
		// Удаляем элементы из сырых данных, чтобы избежать ошибок при десериализации
		elementsRaw, hasElements := rawProject["elements"]
		delete(rawProject, "elements")
		
		// Преобразуем оставшиеся поля в структуру Project
		var project models.Project
		projectBytes, err := bson.Marshal(rawProject)
		if err != nil {
			log.Printf("[PROJECT] Error marshaling project data: %v", err)
			continue
		}
		
		if err := bson.Unmarshal(projectBytes, &project); err != nil {
			log.Printf("[PROJECT] Error unmarshaling project data: %v", err)
			continue
		}
		
		// Обрабатываем элементы отдельно - сохраняем как сырой interface{}
		if hasElements {
			project.Elements = []interface{}{}
			
			// Проверяем, является ли elements массивом
			if elemArray, ok := elementsRaw.(primitive.A); ok {
				for _, elem := range elemArray {
					project.Elements = append(project.Elements, elem)
				}
			} else {
				// Если не массив, добавляем как одиночный элемент
				project.Elements = append(project.Elements, elementsRaw)
			}
		}
		
		// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
		project.NormalizeElements()
		
		projects = append(projects, project)
	}

	log.Printf("[PROJECT] Found %d projects for user %s", len(projects), userID.Hex())
	c.JSON(http.StatusOK, projects)
}

// Возвращает один проект по ID, если у пользователя есть доступ
func getProject(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	
	projectID := c.Param("id")
	
	// Добавляем отладочное логирование
	log.Printf("[PROJECT] getProject called with ID: '%s' for user: %s", projectID, userID.Hex())
	
	if projectID == "" || projectID == "undefined" || projectID == "null" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		log.Printf("[PROJECT] Error converting ID '%s' to ObjectID: %v", projectID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Используем bson.M для первоначального получения проекта
	var rawProject bson.M
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&rawProject)
	if err != nil {
		log.Printf("[PROJECT] Project with ID '%s' not found", projectID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	
	// Преобразуем в структуру Project, но обрабатываем элементы отдельно
	var project models.Project
	
	// Удаляем элементы из сырых данных, чтобы избежать ошибок при десериализации
	elementsRaw, hasElements := rawProject["elements"]
	delete(rawProject, "elements")
	
	// Преобразуем оставшиеся поля в структуру Project
	projectBytes, err := bson.Marshal(rawProject)
	if err != nil {
		log.Printf("[PROJECT] Error marshaling project data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	if err := bson.Unmarshal(projectBytes, &project); err != nil {
		log.Printf("[PROJECT] Error unmarshaling project data: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing project data"})
		return
	}
	
	// Обрабатываем элементы отдельно - сохраняем как сырой interface{}
	if hasElements {
		project.Elements = []interface{}{}
		
		// Проверяем, является ли elements массивом
		if elemArray, ok := elementsRaw.(primitive.A); ok {
			for _, elem := range elemArray {
				project.Elements = append(project.Elements, elem)
			}
		} else {
			// Если не массив, добавляем как одиночный элемент
			project.Elements = append(project.Elements, elementsRaw)
		}
	}

	// Проверяем, является ли пользователь владельцем проекта
	if project.Owner == userID {
		log.Printf("[PROJECT] User %s is the owner of project %s, granting access", userID.Hex(), projectID)
		
		// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
		project.NormalizeElements()
		
		c.JSON(http.StatusOK, project)
		return
	}

	// Проверяем, находится ли проект в команде, где пользователь является участником
	if !project.TeamID.IsZero() {
		// Проверяем, является ли пользователь участником команды
		teamCount, teamErr := config.TeamsCollection.CountDocuments(ctx, bson.M{
			"_id": project.TeamID,
			"$or": []bson.M{
				{"owner": userID},          // Пользователь является владельцем команды
				{"members.userId": userID}, // Пользователь является участником команды
			},
		})
		
		if teamErr == nil && teamCount > 0 {
			log.Printf("[PROJECT] User %s is a member of team %s that contains project %s, granting access", 
				userID.Hex(), project.TeamID.Hex(), projectID)
			
			// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
			project.NormalizeElements()
			
			c.JSON(http.StatusOK, project)
			return
		}
	}

	// Если проект приватный и пользователь не является владельцем или участником команды
	if project.IsPrivate {
		log.Printf("[PROJECT] Access denied to project %s for user %s: project is private", 
			projectID, userID.Hex())
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Если проект публичный
	log.Printf("[PROJECT] Access granted to public project %s for user %s", projectID, userID.Hex())
	
	// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
	project.NormalizeElements()
	
	c.JSON(http.StatusOK, project)
}

// Создает новый проект для аутентифицированного пользователя
func createProject(c *gin.Context) {
	var input models.ProjectCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Создаем проект
	project := models.Project{
		ID:           primitive.NewObjectID(),
		Name:         input.Name,
		Description:  input.Description,
		Owner:        userID,
		Tags:         input.Tags,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		IsPrivate:    input.IsPrivate,
		Title:        input.Title,
		Duration:     input.Duration,
		AudioURL:     input.AudioURL,
		VideoURL:     input.VideoURL,
		Elements:     input.Elements,
		GlbAnimations: input.GlbAnimations,
	}

	// Добавляем ID команды, если предоставлен
	if input.TeamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(input.TeamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			return
		}
		project.TeamID = teamObjID
	}

	// Вставляем проект в базу данных
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.ProjectsCollection.InsertOne(ctx, project)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	// Добавляем запись в историю о создании проекта
	historyEntry := models.CreateHistory(
		userID,
		project.ID,
		models.ActionProjectCreated,
		fmt.Sprintf("Created project '%s'", project.Name),
	)
	
	historyCollection := config.GetCollection("histories")
	_, err = historyCollection.InsertOne(ctx, historyEntry)
	if err != nil {
		// Логируем ошибку, но не прерываем запрос
		config.LogError("PROJECT", fmt.Errorf("failed to create history entry: %w", err))
	}

	c.JSON(http.StatusCreated, project)
}

// Обновляет проект, если у пользователя есть доступ
func updateProject(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" || projectID == "undefined" || projectID == "null" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
		return
	}

	var input models.ProjectUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Создаем документ обновления
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	// Добавляем опциональные поля, если они предоставлены
	if input.Name != "" {
		update["$set"].(bson.M)["name"] = input.Name
	}
	if input.Description != "" {
		update["$set"].(bson.M)["description"] = input.Description
	}
	if input.VideoURL != "" {
		update["$set"].(bson.M)["videoUrl"] = input.VideoURL
	}
	if input.Tags != nil {
		update["$set"].(bson.M)["tags"] = input.Tags
	}
	if input.Title != "" {
		update["$set"].(bson.M)["title"] = input.Title
	}
	if input.IsPrivate != nil {
		update["$set"].(bson.M)["isPrivate"] = *input.IsPrivate
	}
	if input.TeamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(input.TeamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			return
		}
		update["$set"].(bson.M)["teamId"] = teamObjID
	}
	// Обрабатываем новые поля
	if input.Elements != nil {
		update["$set"].(bson.M)["elements"] = input.Elements
		
		// Также извлекаем ключевые кадры для каждого элемента и сохраняем в keyframesJson
		keyframesData := make(map[string]interface{})
		
		for _, element := range input.Elements {
			// Получаем доступ к элементу как к карте для извлечения ID и ключевых кадров
			if elem, ok := element.(map[string]interface{}); ok {
				if elemID, hasID := elem["id"].(string); hasID {
					if keyframes, hasKeyframes := elem["keyframes"]; hasKeyframes {
						keyframesData[elemID] = keyframes
					}
				}
			}
		}
		
		// Если у нас есть ключевые кадры, сериализуем в JSON и сохраняем
		if len(keyframesData) > 0 {
			keyframesJSON, err := json.Marshal(keyframesData)
			if err == nil {
				update["$set"].(bson.M)["keyframesJson"] = string(keyframesJSON)
			}
		}
	}
	
	// Всегда сохраняем длительность, даже если она равна 0
	if input.Duration != nil {
		update["$set"].(bson.M)["duration"] = *input.Duration
	}
	
	// Всегда сохраняем audioUrl, даже если пустой, чтобы можно было удалить аудио
	update["$set"].(bson.M)["audioUrl"] = input.AudioURL
	
	// Обрабатываем GLB анимации
	if input.GlbAnimations != nil {
		update["$set"].(bson.M)["glbAnimations"] = input.GlbAnimations
	}

	// Обновляем проект
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		update,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Получаем обновленный проект
	var updatedProject models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&updatedProject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated project"})
		return
	}

	c.JSON(http.StatusOK, updatedProject)
}

// Удаляет проект, если у пользователя есть доступ
func deleteProject(c *gin.Context) {
	projectID := c.Param("id")
	if projectID == "" || projectID == "undefined" || projectID == "null" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := config.ProjectsCollection.DeleteOne(ctx, bson.M{"_id": projectObjID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete project"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Project deleted successfully"})
}

// Возвращает все проекты без проверки членства в командах
// Это резервный эндпоинт для тестирования и отладки
func getProjectsTest(c *gin.Context) {
	// Получаем ID пользователя из контекста
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Логируем для отладки
	log.Printf("[PROJECT] getProjectsTest called by user: %s", userID.Hex())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Простой фильтр запроса: просто получаем собственные проекты пользователя
	filter := bson.M{"owner": userID}

	// Получаем все подходящие проекты
	findOptions := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.ProjectsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		log.Printf("[PROJECT] Error fetching projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get projects"})
		return
	}
	defer cursor.Close(ctx)

	// Декодируем проекты
	var projects []models.Project
	if err := cursor.All(ctx, &projects); err != nil {
		log.Printf("[PROJECT] Error decoding projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	// Нормализуем элементы в каждом проекте
	for i := range projects {
		projects[i].NormalizeElements()
	}

	log.Printf("[PROJECT] Found %d projects for user %s", len(projects), userID.Hex())
	c.JSON(http.StatusOK, projects)
}

// Возвращает отладочную информацию о проекте
func getProjectDebug(c *gin.Context) {
	projectID := c.Param("id")
	
	// Добавляем отладочное логирование
	log.Printf("[DEBUG ROUTE] GET request received for project ID: %s", projectID)
	
	if projectID == "" || projectID == "undefined" || projectID == "null" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		log.Printf("[DEBUG ROUTE] Error converting ID '%s' to ObjectID: %v", projectID, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
	if err != nil {
		log.Printf("[DEBUG ROUTE] Project with ID '%s' not found", projectID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Нормализуем элементы, чтобы убедиться, что они имеют все необходимые поля
	project.NormalizeElements()

	// Базовая отладочная информация
	debugInfo := gin.H{
		"projectId":          project.ID.Hex(),
		"projectName":        project.Name,
		"elementCount":       len(project.Elements),
		"hasKeyframesJson":   project.KeyframesJSON != "",
		"keyframesJsonLength": len(project.KeyframesJSON),
		"lastUpdated":        project.UpdatedAt,
	}

	// Анализируем данные ключевых кадров
	if project.KeyframesJSON != "" && project.KeyframesJSON != "{}" {
		var keyframesData map[string]interface{}
		err = json.Unmarshal([]byte(project.KeyframesJSON), &keyframesData)
		
		if err == nil {
			elementIDs := make([]string, 0, len(keyframesData))
			totalKeyframes := 0
			
			for elementID, keyframes := range keyframesData {
				elementIDs = append(elementIDs, elementID)
				if keyframesArray, ok := keyframes.([]interface{}); ok {
					totalKeyframes += len(keyframesArray)
				}
			}
			
			log.Printf("[DEBUG ROUTE] keyframesJson is valid JSON with %d element entries", len(elementIDs))
			log.Printf("[DEBUG ROUTE] Total keyframes in keyframesJson: %d", totalKeyframes)
			
			// Добавляем детали ключевых кадров в отладочную информацию
			debugInfo["keyframeData"] = gin.H{
				"elementCount":  len(elementIDs),
				"elementIds":    elementIDs,
				"totalKeyframes": totalKeyframes,
			}
			
			// Анализ по каждому элементу
			elements := make([]gin.H, 0)
			for _, element := range project.Elements {
				if elemMap, ok := element.(map[string]interface{}); ok {
					if elemID, hasID := elemMap["id"].(string); hasID {
						elementKeyframes := make([]interface{}, 0)
						if keyframesData[elemID] != nil {
							if keyframesArray, ok := keyframesData[elemID].([]interface{}); ok {
								elementKeyframes = keyframesArray
							}
						}
						
						elementInfo := gin.H{
							"elementId":     elemID,
							"elementType":   elemMap["type"],
							"keyframeCount": len(elementKeyframes),
						}
						
						if len(elementKeyframes) > 0 {
							elementInfo["keyframeSample"] = elementKeyframes[0]
						}
						
						elements = append(elements, elementInfo)
					}
				}
			}
			
			debugInfo["elements"] = elements
		} else {
			log.Printf("[DEBUG ROUTE] keyframesJson is NOT valid JSON: %s", err.Error())
			debugInfo["parseError"] = err.Error()
		}
	}

	log.Printf("[DEBUG ROUTE] Sending debug response for project %s", projectID)
	c.JSON(http.StatusOK, debugInfo)
}

// Анализирует объект проекта, отправленный клиентом
func postProjectDebug(c *gin.Context) {
	projectID := c.Param("id")
	log.Printf("[DEBUG ROUTE] POST request received for project ID: %s", projectID)

	// Получаем данные проекта из тела запроса
	var projectData map[string]interface{}
	if err := c.ShouldBindJSON(&projectData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Создаем подробную диагностическую информацию о полученном проекте
	diagnostics := gin.H{
		"projectId":            projectID,
		"hasElements":          projectData["elements"] != nil,
		"elementCount":         0,
		"elementsWithKeyframes": 0,
		"totalKeyframes":       0,
		"elementDetails":       []gin.H{},
		"keyframesSample":      nil,
	}

	// Анализируем элементы и ключевые кадры
	if elements, hasElements := projectData["elements"].([]interface{}); hasElements && len(elements) > 0 {
		diagnostics["elementCount"] = len(elements)
		elementDetails := make([]gin.H, 0)

		for index, element := range elements {
			if elemMap, ok := element.(map[string]interface{}); ok {
				elementDetail := gin.H{
					"index":              index,
					"id":                 elemMap["id"],
					"type":               elemMap["type"],
					"keyframeCount":      0,
					"hasKeyframesProperty": false,
					"keyframesType":      "undefined",
					"isKeyframesArray":   false,
				}

				if keyframes, hasKeyframes := elemMap["keyframes"]; hasKeyframes {
					elementDetail["hasKeyframesProperty"] = true
					elementDetail["keyframesType"] = fmt.Sprintf("%T", keyframes)

					if keyframesArray, ok := keyframes.([]interface{}); ok {
						elementDetail["isKeyframesArray"] = true
						elementDetail["keyframeCount"] = len(keyframesArray)

						if len(keyframesArray) > 0 {
							diagnostics["elementsWithKeyframes"] = diagnostics["elementsWithKeyframes"].(int) + 1
							diagnostics["totalKeyframes"] = diagnostics["totalKeyframes"].(int) + len(keyframesArray)

							// Сохраняем образец первого найденного ключевого кадра
							if diagnostics["keyframesSample"] == nil {
								diagnostics["keyframesSample"] = keyframesArray[0]
							}
						}
					}
				}

				elementDetails = append(elementDetails, elementDetail)
			}
		}

		diagnostics["elementDetails"] = elementDetails
	}

	// Теперь обрабатываем как реальное сохранение, но только для диагностики
	// Извлекаем и проверяем ключевые кадры из всех элементов
	keyframesData := make(map[string]interface{})
	totalKeyframes := 0

	if elements, hasElements := projectData["elements"].([]interface{}); hasElements {
		for _, element := range elements {
			if elemMap, ok := element.(map[string]interface{}); ok {
				if elemID, hasID := elemMap["id"].(string); hasID {
					if keyframes, hasKeyframes := elemMap["keyframes"]; hasKeyframes {
						log.Printf("[DEBUG ROUTE] Processing keyframes for element %s", elemID)

						// Фильтруем действительные ключевые кадры
						if keyframesArray, ok := keyframes.([]interface{}); ok {
							validKeyframes := make([]interface{}, 0)

							for _, kf := range keyframesArray {
								if kfMap, ok := kf.(map[string]interface{}); ok {
									// Проверяем, является ли ключевой кадр действительным
									if time, hasTime := kfMap["time"].(float64); hasTime && !math.IsNaN(time) {
										if position, hasPosition := kfMap["position"].(map[string]interface{}); hasPosition {
											if x, hasX := position["x"].(float64); hasX && !math.IsNaN(x) {
												if y, hasY := position["y"].(float64); hasY && !math.IsNaN(y) {
													if opacity, hasOpacity := kfMap["opacity"].(float64); hasOpacity && !math.IsNaN(opacity) {
														validKeyframes = append(validKeyframes, kf)
													}
												}
											}
										}
									}
								}
							}

							if len(validKeyframes) > 0 {
								keyframesData[elemID] = validKeyframes
								totalKeyframes += len(validKeyframes)
								log.Printf("[DEBUG ROUTE] Added %d valid keyframes for element %s", len(validKeyframes), elemID)
							}
						}
					}
				}
			}
		}
	}

	// Преобразуем в JSON строку (как при реальном сохранении)
	var keyframesJSON string
	if totalKeyframes > 0 {
		keyframesJSONBytes, err := json.Marshal(keyframesData)
		if err == nil {
			keyframesJSON = string(keyframesJSONBytes)
			log.Printf("[DEBUG ROUTE] Serialized %d keyframes to JSON string (%d chars)", totalKeyframes, len(keyframesJSON))
		} else {
			log.Printf("[DEBUG ROUTE] Error serializing keyframes to JSON: %v", err)
			keyframesJSON = "{}"
		}
	} else {
		keyframesJSON = "{}"
		log.Printf("[DEBUG ROUTE] No valid keyframes to serialize, using empty object")
	}

	// Добавляем результаты в диагностику
	diagnostics["extractedKeyframesData"] = gin.H{
		"elementCount":       len(keyframesData),
		"totalKeyframes":     totalKeyframes,
		"sampleElementId":    "",
		"keyframesJsonLength": len(keyframesJSON),
	}

	// Добавляем пример ID элемента, если доступен
	for elemID := range keyframesData {
		diagnostics["extractedKeyframesData"].(gin.H)["sampleElementId"] = elemID
		break
	}

	log.Printf("[DEBUG ROUTE] Sending save diagnostics")
	c.JSON(http.StatusOK, diagnostics)
} 