package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Project model
type Project struct {
	ID            primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Name          string             `json:"name" bson:"name"`
	Description   string             `json:"description" bson:"description"`
	Owner         primitive.ObjectID `json:"owner" bson:"owner"`
	TeamID        primitive.ObjectID `json:"teamId,omitempty" bson:"teamId,omitempty"`
	VideoURL      string             `json:"videoUrl,omitempty" bson:"videoUrl,omitempty"`
	Keyframes     []KeyframeRef      `json:"keyframes,omitempty" bson:"keyframes,omitempty"`
	KeyframesJSON string             `json:"keyframesJson,omitempty" bson:"keyframesJson,omitempty"`
	Tags          []string           `json:"tags,omitempty" bson:"tags,omitempty"`
	CreatedAt     time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt     time.Time          `json:"updatedAt" bson:"updatedAt"`
	IsPrivate     bool               `json:"isPrivate" bson:"isPrivate"`
	Title         string             `json:"title" bson:"title"`
	Elements      []interface{}      `json:"elements,omitempty" bson:"elements,omitempty"`
	Duration      int                `json:"duration,omitempty" bson:"duration,omitempty"`
	AudioURL      string             `json:"audioUrl,omitempty" bson:"audioUrl,omitempty"`
}

// Element represents a project element
type Element struct {
	ID       string     `json:"id"`
	Type     string     `json:"type"`
	Position Position   `json:"position"`
	Size     Size       `json:"size"`
	Style    Style      `json:"style"`
	Content  string     `json:"content"`
	Keyframes []interface{} `json:"keyframes"`
}

// Position represents the position of an element
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Size represents the size of an element
type Size struct {
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Style represents the style of an element
type Style struct {
	Color           string  `json:"color"`
	BackgroundColor string  `json:"backgroundColor"`
	BorderColor     string  `json:"borderColor"`
	BorderWidth     float64 `json:"borderWidth"`
	Opacity         float64 `json:"opacity"`
	ZIndex          float64 `json:"zIndex"`
}

// NormalizeElements ensures all elements have the required fields
func (p *Project) NormalizeElements() {
	if p.Elements == nil {
		p.Elements = []interface{}{}
		return
	}

	normalizedElements := []interface{}{}
	idCounter := 1

	for _, elem := range p.Elements {
		// Convert to map for easy access
		var elemMap map[string]interface{}
		
		// Try to convert directly if it's already a map
		if em, ok := elem.(map[string]interface{}); ok {
			elemMap = em
		} else if elemArray, ok := elem.([]interface{}); ok {
			// If element is an array, process each item in the array
			for _, arrayItem := range elemArray {
				if itemMap, ok := arrayItem.(map[string]interface{}); ok {
					// Process this map item and add to normalized elements
					normalizedItem := normalizeElement(itemMap, &idCounter)
					if normalizedItem != nil {
						normalizedElements = append(normalizedElements, normalizedItem)
					}
				}
			}
			// Skip further processing of this element since we handled the array
			continue
		} else if elemArray, ok := elem.(primitive.A); ok {
			// Handle BSON array type
			for _, arrayItem := range elemArray {
				if itemMap, ok := arrayItem.(map[string]interface{}); ok {
					// Process this map item and add to normalized elements
					normalizedItem := normalizeElement(itemMap, &idCounter)
					if normalizedItem != nil {
						normalizedElements = append(normalizedElements, normalizedItem)
					}
				}
			}
			// Skip further processing of this element since we handled the array
			continue
		} else {
			// Try to marshal and unmarshal to convert to map
			bytes, err := json.Marshal(elem)
			if err != nil {
				fmt.Printf("Error marshaling element: %v\n", err)
				continue
			}
			
			err = json.Unmarshal(bytes, &elemMap)
			if err != nil {
				fmt.Printf("Error unmarshaling element: %v\n", err)
				continue
			}
		}

		// Process the element map
		normalizedElem := normalizeElement(elemMap, &idCounter)
		if normalizedElem != nil {
			normalizedElements = append(normalizedElements, normalizedElem)
		}
	}

	// Replace original elements with normalized ones
	p.Elements = normalizedElements
}

// Helper function to normalize a single element
func normalizeElement(elemMap map[string]interface{}, idCounter *int) map[string]interface{} {
	if elemMap == nil {
		return nil
	}

	// Generate ID if not present
	elementID, hasID := elemMap["id"].(string)
	if !hasID || elementID == "" {
		// Check for _id
		if id, hasAltID := elemMap["_id"].(string); hasAltID && id != "" {
			elementID = id
			elemMap["id"] = elementID
			fmt.Printf("Used _id as id for element: %s\n", elementID)
		} else {
			elementID = fmt.Sprintf("generated-%d", *idCounter)
			elemMap["id"] = elementID
			*idCounter++
			fmt.Printf("Generated new id for element: %s\n", elementID)
		}
	}

	// Ensure type is present
	elementType, hasType := elemMap["type"].(string)
	if !hasType || elementType == "" {
		// Check for originalType
		if origType, hasOrigType := elemMap["originalType"].(string); hasOrigType && origType != "" {
			elementType = origType
			elemMap["type"] = elementType
			fmt.Printf("Used originalType as type for element: %s\n", elementType)
		} else {
			elementType = "rectangle" // Default type
			elemMap["type"] = elementType
			fmt.Printf("Used default type for element: %s\n", elementID)
		}
	}

	// Ensure position is present and valid
	position, hasPosition := elemMap["position"].(map[string]interface{})
	if !hasPosition {
		elemMap["position"] = map[string]interface{}{
			"x": float64(100),
			"y": float64(100),
		}
	} else {
		// Convert position values to float64
		if x, ok := position["x"]; ok {
			position["x"] = convertToFloat64(x, 100)
		} else {
			position["x"] = float64(100)
		}

		if y, ok := position["y"]; ok {
			position["y"] = convertToFloat64(y, 100)
		} else {
			position["y"] = float64(100)
		}
	}

	// Ensure size is present and valid
	size, hasSize := elemMap["size"].(map[string]interface{})
	if !hasSize {
		elemMap["size"] = map[string]interface{}{
			"width":  float64(100),
			"height": float64(100),
		}
	} else {
		// Convert size values to float64
		if width, ok := size["width"]; ok {
			size["width"] = convertToFloat64(width, 100)
		} else {
			size["width"] = float64(100)
		}

		if height, ok := size["height"]; ok {
			size["height"] = convertToFloat64(height, 100)
		} else {
			size["height"] = float64(100)
		}
	}

	// Ensure style is present
	style, hasStyle := elemMap["style"].(map[string]interface{})
	if !hasStyle {
		elemMap["style"] = map[string]interface{}{
			"color":           "#000000",
			"backgroundColor": "#cccccc",
			"borderColor":     "#000000",
			"borderWidth":     float64(1),
			"opacity":         float64(1),
			"zIndex":          float64(0),
		}
	} else {
		// Ensure style has required fields
		if _, ok := style["color"]; !ok {
			style["color"] = "#000000"
		}
		if _, ok := style["backgroundColor"]; !ok {
			style["backgroundColor"] = "#cccccc"
		}
		if _, ok := style["borderColor"]; !ok {
			style["borderColor"] = "#000000"
		}
		if _, ok := style["borderWidth"]; !ok {
			style["borderWidth"] = float64(1)
		} else {
			style["borderWidth"] = convertToFloat64(style["borderWidth"], 1)
		}
		if _, ok := style["opacity"]; !ok {
			style["opacity"] = float64(1)
		} else {
			style["opacity"] = convertToFloat64(style["opacity"], 1)
		}
		if _, ok := style["zIndex"]; !ok {
			style["zIndex"] = float64(0)
		} else {
			style["zIndex"] = convertToFloat64(style["zIndex"], 0)
		}
	}

	// Ensure content field exists
	if _, ok := elemMap["content"]; !ok {
		elemMap["content"] = ""
	}

	// Ensure keyframes field exists
	if _, ok := elemMap["keyframes"]; !ok {
		elemMap["keyframes"] = []interface{}{}
	}

	return elemMap
}

// Helper function to convert various types to float64
func convertToFloat64(value interface{}, defaultValue float64) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case string:
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return defaultValue
}

// KeyframeRef represents a keyframe reference in Project model
type KeyframeRef struct {
	KeyframeID primitive.ObjectID `json:"keyframeId" bson:"keyframeId"`
	Timestamp  float64            `json:"timestamp" bson:"timestamp"`
	Label      string             `json:"label,omitempty" bson:"label,omitempty"`
}

// ProjectCreateInput is the input for creating a project
type ProjectCreateInput struct {
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	TeamID      string   `json:"teamId,omitempty"`
	Tags        []string `json:"tags,omitempty"`
	Title       string   `json:"title"`
	IsPrivate   bool     `json:"isPrivate"`
}

// ProjectUpdateInput is the input for updating a project
type ProjectUpdateInput struct {
	Name        string        `json:"name,omitempty"`
	Description string        `json:"description,omitempty"`
	TeamID      string        `json:"teamId,omitempty"`
	VideoURL    string        `json:"videoUrl,omitempty"`
	Tags        []string      `json:"tags,omitempty"`
	Title       string        `json:"title,omitempty"`
	IsPrivate   *bool         `json:"isPrivate,omitempty"`
	Elements    []interface{} `json:"elements,omitempty"`
	Duration    *int          `json:"duration,omitempty"`
	AudioURL    string        `json:"audioUrl,omitempty"`
} 