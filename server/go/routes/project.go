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

// RegisterProjectRoutes registers all project routes
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
		
		// Register a test endpoint that doesn't check team memberships
		projects.GET("/test", getProjectsTest)
		router.GET("/projects-test", middleware.JWTMiddleware(cfg), getProjectsTest)
	}
}

// getProjects returns all projects accessible by the authenticated user
func getProjects(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	log.Printf("[PROJECT] Fetching projects for user: %s", userID.Hex())

	// Get user's team memberships to find team projects
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	err = config.UsersCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user data"})
		return
	}

	// Create a list of team IDs the user is a member of
	var teamIDs []primitive.ObjectID
	for _, team := range user.Teams {
		teamIDs = append(teamIDs, team)
	}

	// Query filter: user's own projects OR projects from teams they belong to OR public projects
	filter := bson.M{
		"$or": []bson.M{
			{"owner": userID},
			{"isPrivate": false},
		},
	}

	// Add team projects if the user belongs to any teams
	if len(teamIDs) > 0 {
		filter["$or"] = append(filter["$or"].([]bson.M), bson.M{"teamId": bson.M{"$in": teamIDs}})
	}

	// Get all matching projects as raw BSON documents first
	findOptions := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.ProjectsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		log.Printf("[PROJECT] Error fetching projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get projects"})
		return
	}
	defer cursor.Close(ctx)

	// Process each project individually to handle elements properly
	var projects []models.Project
	var rawProjects []bson.M
	if err := cursor.All(ctx, &rawProjects); err != nil {
		log.Printf("[PROJECT] Error decoding projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	// Process each raw project
	for _, rawProject := range rawProjects {
		// Remove elements from raw data to avoid unmarshaling errors
		elementsRaw, hasElements := rawProject["elements"]
		delete(rawProject, "elements")
		
		// Convert the remaining fields to Project struct
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
		
		// Handle elements separately - store as raw interface{}
		if hasElements {
			project.Elements = []interface{}{}
			
			// Check if elements is an array
			if elemArray, ok := elementsRaw.(primitive.A); ok {
				for _, elem := range elemArray {
					project.Elements = append(project.Elements, elem)
				}
			} else {
				// If not an array, add as a single element
				project.Elements = append(project.Elements, elementsRaw)
			}
		}
		
		// Normalize elements to ensure they have all required fields
		project.NormalizeElements()
		
		projects = append(projects, project)
	}

	log.Printf("[PROJECT] Found %d projects for user %s", len(projects), userID.Hex())
	c.JSON(http.StatusOK, projects)
}

// getProject returns a single project by ID if the user has access
func getProject(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	
	projectID := c.Param("id")
	
	// Add debug logging
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

	// Use a raw bson.M to retrieve the project first
	var rawProject bson.M
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&rawProject)
	if err != nil {
		log.Printf("[PROJECT] Project with ID '%s' not found", projectID)
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	
	// Convert to a Project struct, but handle elements separately
	var project models.Project
	
	// Remove elements from raw data to avoid unmarshaling errors
	elementsRaw, hasElements := rawProject["elements"]
	delete(rawProject, "elements")
	
	// Convert the remaining fields to Project struct
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
	
	// Handle elements separately - store as raw interface{}
	if hasElements {
		project.Elements = []interface{}{}
		
		// Check if elements is an array
		if elemArray, ok := elementsRaw.(primitive.A); ok {
			for _, elem := range elemArray {
				project.Elements = append(project.Elements, elem)
			}
		} else {
			// If not an array, add as a single element
			project.Elements = append(project.Elements, elementsRaw)
		}
	}

	// Check if user is the project owner
	if project.Owner == userID {
		log.Printf("[PROJECT] User %s is the owner of project %s, granting access", userID.Hex(), projectID)
		
		// Normalize elements to ensure they have all required fields
		project.NormalizeElements()
		
		c.JSON(http.StatusOK, project)
		return
	}

	// Check if project is in a team where user is a member
	if !project.TeamID.IsZero() {
		// Check if user is a member of the team
		teamCount, teamErr := config.TeamsCollection.CountDocuments(ctx, bson.M{
			"_id": project.TeamID,
			"$or": []bson.M{
				{"owner": userID},          // User is team owner
				{"members.userId": userID}, // User is team member
			},
		})
		
		if teamErr == nil && teamCount > 0 {
			log.Printf("[PROJECT] User %s is a member of team %s that contains project %s, granting access", 
				userID.Hex(), project.TeamID.Hex(), projectID)
			
			// Normalize elements to ensure they have all required fields
			project.NormalizeElements()
			
			c.JSON(http.StatusOK, project)
			return
		}
	}

	// If project is private and user is not owner or team member
	if project.IsPrivate {
		log.Printf("[PROJECT] Access denied to project %s for user %s: project is private", 
			projectID, userID.Hex())
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// If project is public
	log.Printf("[PROJECT] Access granted to public project %s for user %s", projectID, userID.Hex())
	
	// Normalize elements to ensure they have all required fields
	project.NormalizeElements()
	
	c.JSON(http.StatusOK, project)
}

// createProject creates a new project for the authenticated user
func createProject(c *gin.Context) {
	var input models.ProjectCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Create project
	project := models.Project{
		ID:          primitive.NewObjectID(),
		Name:        input.Name,
		Description: input.Description,
		Owner:       userID,
		Tags:        input.Tags,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		IsPrivate:   input.IsPrivate,
		Title:       input.Title,
	}

	// Add team ID if provided
	if input.TeamID != "" {
		teamObjID, err := primitive.ObjectIDFromHex(input.TeamID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid team ID format"})
			return
		}
		project.TeamID = teamObjID
	}

	// Insert project into database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.ProjectsCollection.InsertOne(ctx, project)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create project"})
		return
	}

	// Add history entry for project creation
	historyEntry := models.CreateHistory(
		userID,
		project.ID,
		models.ActionProjectCreated,
		fmt.Sprintf("Created project '%s'", project.Name),
	)
	
	historyCollection := config.GetCollection("histories")
	_, err = historyCollection.InsertOne(ctx, historyEntry)
	if err != nil {
		// Log the error but don't fail the request
		config.LogError("PROJECT", fmt.Errorf("failed to create history entry: %w", err))
	}

	c.JSON(http.StatusCreated, project)
}

// updateProject updates a project if the user has access
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

	// Build update document
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	// Add optional fields if provided
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
	// Handle new fields
	if input.Elements != nil {
		update["$set"].(bson.M)["elements"] = input.Elements
		
		// Also extract keyframes for each element and store in keyframesJson
		keyframesData := make(map[string]interface{})
		
		for _, element := range input.Elements {
			// Access element as a map to extract ID and keyframes
			if elem, ok := element.(map[string]interface{}); ok {
				if elemID, hasID := elem["id"].(string); hasID {
					if keyframes, hasKeyframes := elem["keyframes"]; hasKeyframes {
						keyframesData[elemID] = keyframes
					}
				}
			}
		}
		
		// If we have keyframes, serialize to JSON and store
		if len(keyframesData) > 0 {
			keyframesJSON, err := json.Marshal(keyframesData)
			if err == nil {
				update["$set"].(bson.M)["keyframesJson"] = string(keyframesJSON)
			}
		}
	}
	if input.Duration != nil {
		update["$set"].(bson.M)["duration"] = *input.Duration
	}
	if input.AudioURL != "" {
		update["$set"].(bson.M)["audioUrl"] = input.AudioURL
	}

	// Update project
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

	// Get updated project
	var updatedProject models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&updatedProject)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated project"})
		return
	}

	c.JSON(http.StatusOK, updatedProject)
}

// deleteProject deletes a project if the user has access
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

// getProjectsTest returns all projects without checking team memberships
// This is a fallback endpoint for testing and debugging
func getProjectsTest(c *gin.Context) {
	// Get user ID from context
	userID, err := middleware.GetUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Log for debugging
	log.Printf("[PROJECT] getProjectsTest called by user: %s", userID.Hex())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Simple query filter: just get user's own projects
	filter := bson.M{"owner": userID}

	// Get all matching projects
	findOptions := options.Find().SetSort(bson.M{"updatedAt": -1})
	cursor, err := config.ProjectsCollection.Find(ctx, filter, findOptions)
	if err != nil {
		log.Printf("[PROJECT] Error fetching projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get projects"})
		return
	}
	defer cursor.Close(ctx)

	// Decode projects
	var projects []models.Project
	if err := cursor.All(ctx, &projects); err != nil {
		log.Printf("[PROJECT] Error decoding projects: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode projects"})
		return
	}

	// Normalize elements in each project
	for i := range projects {
		projects[i].NormalizeElements()
	}

	log.Printf("[PROJECT] Found %d projects for user %s", len(projects), userID.Hex())
	c.JSON(http.StatusOK, projects)
}

// getProjectDebug returns debug information about a project
func getProjectDebug(c *gin.Context) {
	projectID := c.Param("id")
	
	// Add debug logging
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

	// Normalize elements to ensure they have all required fields
	project.NormalizeElements()

	// Basic debug info
	debugInfo := gin.H{
		"projectId":          project.ID.Hex(),
		"projectName":        project.Name,
		"elementCount":       len(project.Elements),
		"hasKeyframesJson":   project.KeyframesJSON != "",
		"keyframesJsonLength": len(project.KeyframesJSON),
		"lastUpdated":        project.UpdatedAt,
	}

	// Analyze keyframes data
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
			
			// Add keyframe details to debug info
			debugInfo["keyframeData"] = gin.H{
				"elementCount":  len(elementIDs),
				"elementIds":    elementIDs,
				"totalKeyframes": totalKeyframes,
			}
			
			// Element-by-element analysis
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

// postProjectDebug analyzes a project object sent by the client
func postProjectDebug(c *gin.Context) {
	projectID := c.Param("id")
	log.Printf("[DEBUG ROUTE] POST request received for project ID: %s", projectID)

	// Get project data from request body
	var projectData map[string]interface{}
	if err := c.ShouldBindJSON(&projectData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create detailed diagnostic info about the received project
	diagnostics := gin.H{
		"projectId":            projectID,
		"hasElements":          projectData["elements"] != nil,
		"elementCount":         0,
		"elementsWithKeyframes": 0,
		"totalKeyframes":       0,
		"elementDetails":       []gin.H{},
		"keyframesSample":      nil,
	}

	// Analyze elements and keyframes
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

							// Save a sample of the first keyframe we find
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

	// Now process as the real save would, but just for diagnostics
	// Extract and validate keyframes from all elements
	keyframesData := make(map[string]interface{})
	totalKeyframes := 0

	if elements, hasElements := projectData["elements"].([]interface{}); hasElements {
		for _, element := range elements {
			if elemMap, ok := element.(map[string]interface{}); ok {
				if elemID, hasID := elemMap["id"].(string); hasID {
					if keyframes, hasKeyframes := elemMap["keyframes"]; hasKeyframes {
						log.Printf("[DEBUG ROUTE] Processing keyframes for element %s", elemID)

						// Filter valid keyframes
						if keyframesArray, ok := keyframes.([]interface{}); ok {
							validKeyframes := make([]interface{}, 0)

							for _, kf := range keyframesArray {
								if kfMap, ok := kf.(map[string]interface{}); ok {
									// Check if keyframe is valid
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

	// Convert to JSON string (just like the real save would)
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

	// Add results to diagnostics
	diagnostics["extractedKeyframesData"] = gin.H{
		"elementCount":       len(keyframesData),
		"totalKeyframes":     totalKeyframes,
		"sampleElementId":    "",
		"keyframesJsonLength": len(keyframesJSON),
	}

	// Add sample element ID if available
	for elemID := range keyframesData {
		diagnostics["extractedKeyframesData"].(gin.H)["sampleElementId"] = elemID
		break
	}

	log.Printf("[DEBUG ROUTE] Sending save diagnostics")
	c.JSON(http.StatusOK, diagnostics)
} 