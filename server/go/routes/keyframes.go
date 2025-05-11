package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kktjss/dance-flow/config"
	"github.com/kktjss/dance-flow/middleware"
	"github.com/kktjss/dance-flow/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// RegisterKeyframesRoutes registers all keyframe routes
func RegisterKeyframesRoutes(router *gin.RouterGroup, cfg *config.Config) {
	// Direct keyframes endpoint (matches the Node.js endpoint)
	direct := router.Group("/direct-keyframes")
	direct.Use(middleware.JWTMiddleware(cfg))
	{
		direct.POST("", createDirectKeyframe)
		direct.GET("/project/:projectId", getProjectKeyframes)
		direct.PUT("/:id", updateKeyframe)
		direct.DELETE("/:id", deleteKeyframe)
	}
}

// createDirectKeyframe adds a new keyframe directly
func createDirectKeyframe(c *gin.Context) {
	var input models.KeyframeCreateInput
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

	// Convert project ID to ObjectID
	projectObjID, err := primitive.ObjectIDFromHex(input.ProjectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Create keyframe
	keyframe := models.Keyframe{
		ID:        primitive.NewObjectID(),
		ProjectID: projectObjID,
		Timestamp: input.Timestamp,
		Label:     input.Label,
		PoseData:  input.PoseData,
		ImageData: input.ImageData,
		CreatedBy: userID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Insert keyframe into database
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = config.KeyframesCollection.InsertOne(ctx, keyframe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create keyframe"})
		return
	}

	// Update project to include the keyframe reference
	keyframeRef := models.KeyframeRef{
		KeyframeID: keyframe.ID,
		Timestamp:  keyframe.Timestamp,
		Label:      keyframe.Label,
	}

	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": projectObjID},
		bson.M{
			"$push": bson.M{"keyframes": keyframeRef},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project with keyframe"})
		return
	}

	c.JSON(http.StatusCreated, keyframe)
}

// getProjectKeyframes gets all keyframes for a project
func getProjectKeyframes(c *gin.Context) {
	projectID := c.Param("projectId")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	projectObjID, err := primitive.ObjectIDFromHex(projectID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if project exists and user has access
	var project models.Project
	err = config.ProjectsCollection.FindOne(ctx, bson.M{"_id": projectObjID}).Decode(&project)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}

	// Get keyframes for project
	cursor, err := config.KeyframesCollection.Find(
		ctx,
		bson.M{"projectId": projectObjID},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get keyframes"})
		return
	}
	defer cursor.Close(ctx)

	var keyframes []models.Keyframe
	if err := cursor.All(ctx, &keyframes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode keyframes"})
		return
	}

	c.JSON(http.StatusOK, keyframes)
}

// updateKeyframe updates a keyframe
func updateKeyframe(c *gin.Context) {
	keyframeID := c.Param("id")
	if keyframeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyframe ID is required"})
		return
	}

	var input models.KeyframeUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	keyframeObjID, err := primitive.ObjectIDFromHex(keyframeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid keyframe ID format"})
		return
	}

	// Create update document
	update := bson.M{
		"$set": bson.M{
			"updatedAt": time.Now(),
		},
	}

	// Add optional fields if provided
	if input.Label != "" {
		update["$set"].(bson.M)["label"] = input.Label
	}
	if input.PoseData != nil {
		update["$set"].(bson.M)["poseData"] = input.PoseData
	}
	if input.ImageData != "" {
		update["$set"].(bson.M)["imageData"] = input.ImageData
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Update keyframe
	result, err := config.KeyframesCollection.UpdateOne(
		ctx,
		bson.M{"_id": keyframeObjID},
		update,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update keyframe"})
		return
	}

	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Get updated keyframe
	var updatedKeyframe models.Keyframe
	err = config.KeyframesCollection.FindOne(ctx, bson.M{"_id": keyframeObjID}).Decode(&updatedKeyframe)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated keyframe"})
		return
	}

	// Update keyframe reference in project if label changed
	if input.Label != "" {
		_, err = config.ProjectsCollection.UpdateOne(
			ctx,
			bson.M{"keyframes.keyframeId": keyframeObjID},
			bson.M{
				"$set": bson.M{
					"keyframes.$.label": input.Label,
					"updatedAt":         time.Now(),
				},
			},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project reference"})
			return
		}
	}

	c.JSON(http.StatusOK, updatedKeyframe)
}

// deleteKeyframe deletes a keyframe
func deleteKeyframe(c *gin.Context) {
	keyframeID := c.Param("id")
	if keyframeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Keyframe ID is required"})
		return
	}

	keyframeObjID, err := primitive.ObjectIDFromHex(keyframeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid keyframe ID format"})
		return
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// First, get the keyframe to get the project ID
	var keyframe models.Keyframe
	err = config.KeyframesCollection.FindOne(ctx, bson.M{"_id": keyframeObjID}).Decode(&keyframe)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Delete keyframe
	result, err := config.KeyframesCollection.DeleteOne(ctx, bson.M{"_id": keyframeObjID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete keyframe"})
		return
	}

	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Keyframe not found"})
		return
	}

	// Remove keyframe reference from project
	_, err = config.ProjectsCollection.UpdateOne(
		ctx,
		bson.M{"_id": keyframe.ProjectID},
		bson.M{
			"$pull": bson.M{"keyframes": bson.M{"keyframeId": keyframeObjID}},
			"$set":  bson.M{"updatedAt": time.Now()},
		},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update project"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Keyframe deleted successfully"})
} 