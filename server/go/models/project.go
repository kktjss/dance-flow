package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Модель проекта
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
	Duration      int                `json:"duration" bson:"duration"`
	AudioURL      string             `json:"audioUrl,omitempty" bson:"audioUrl,omitempty"`
	GlbAnimations []GlbAnimation     `json:"glbAnimations,omitempty" bson:"glbAnimations,omitempty"`
}

// GlbAnimation представляет файл анимации GLB
type GlbAnimation struct {
	ID          string `json:"id" bson:"id"`
	URL         string `json:"url" bson:"url"`
	Name        string `json:"name" bson:"name"`
	Description string `json:"description,omitempty" bson:"description,omitempty"`
}

// Element представляет элемент проекта
type Element struct {
	ID       string     `json:"id"`
	Type     string     `json:"type"`
	Position Position   `json:"position"`
	Size     Size       `json:"size"`
	Style    Style      `json:"style"`
	Content  string     `json:"content"`
	Keyframes []interface{} `json:"keyframes"`
}

// Position представляет позицию элемента
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Size представляет размер элемента
type Size struct {
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Style представляет стиль элемента
type Style struct {
	Color           string  `json:"color"`
	BackgroundColor string  `json:"backgroundColor"`
	BorderColor     string  `json:"borderColor"`
	BorderWidth     float64 `json:"borderWidth"`
	Opacity         float64 `json:"opacity"`
	ZIndex          float64 `json:"zIndex"`
}

// NormalizeElements обеспечивает наличие всех необходимых полей у элементов
func (p *Project) NormalizeElements() {
	if p.Elements == nil {
		p.Elements = make([]interface{}, 0)
		return
	}

	normalizedElements := make([]interface{}, 0)
	idCounter := 1

	for _, elem := range p.Elements {
		if elem == nil {
			continue
		}

		// Преобразуем в map для удобного доступа
		var elemMap map[string]interface{}
		
		// Пробуем преобразовать напрямую, если это уже map
		if em, ok := elem.(map[string]interface{}); ok {
			elemMap = em
		} else if elemArray, ok := elem.([]interface{}); ok {
			// Если элемент является массивом, обрабатываем каждый элемент массива
			for _, arrayItem := range elemArray {
				if itemMap, ok := arrayItem.(map[string]interface{}); ok {
					// Обрабатываем этот элемент map и добавляем в нормализованные элементы
					normalizedItem := normalizeElement(itemMap, &idCounter)
					if normalizedItem != nil {
						normalizedElements = append(normalizedElements, normalizedItem)
					}
				}
			}
			// Пропускаем дальнейшую обработку этого элемента, так как мы обработали массив
			continue
		} else if elemArray, ok := elem.(primitive.A); ok {
			// Обрабатываем тип массива BSON
			for _, arrayItem := range elemArray {
				if itemMap, ok := arrayItem.(map[string]interface{}); ok {
					// Обрабатываем этот элемент map и добавляем в нормализованные элементы
					normalizedItem := normalizeElement(itemMap, &idCounter)
					if normalizedItem != nil {
						normalizedElements = append(normalizedElements, normalizedItem)
					}
				}
			}
			// Пропускаем дальнейшую обработку этого элемента, так как мы обработали массив
			continue
		} else {
			// Пробуем выполнить marshal и unmarshal для преобразования в map
			bytes, err := json.Marshal(elem)
			if err != nil {
				fmt.Printf("Ошибка при маршалинге элемента: %v\n", err)
				continue
			}
			
			err = json.Unmarshal(bytes, &elemMap)
			if err != nil {
				fmt.Printf("Ошибка при анмаршалинге элемента: %v\n", err)
				continue
			}
		}

		// Обрабатываем map элемента
		normalizedElem := normalizeElement(elemMap, &idCounter)
		if normalizedElem != nil {
			normalizedElements = append(normalizedElements, normalizedElem)
		}
	}

	// Заменяем оригинальные элементы нормализованными
	p.Elements = normalizedElements
}

// Вспомогательная функция для нормализации одного элемента
func normalizeElement(elemMap map[string]interface{}, idCounter *int) map[string]interface{} {
	if elemMap == nil {
		return nil
	}

	// Генерируем ID, если его нет
	elementID, hasID := elemMap["id"].(string)
	if !hasID || elementID == "" {
		// Проверяем наличие _id
		if id, hasAltID := elemMap["_id"].(string); hasAltID && id != "" {
			elementID = id
			elemMap["id"] = elementID
			fmt.Printf("Использован _id в качестве id для элемента: %s\n", elementID)
		} else {
			elementID = fmt.Sprintf("generated-%d", *idCounter)
			elemMap["id"] = elementID
			*idCounter++
			fmt.Printf("Сгенерирован новый id для элемента: %s\n", elementID)
		}
	}

	// Проверяем наличие типа
	elementType, hasType := elemMap["type"].(string)
	if !hasType || elementType == "" {
		// Проверяем наличие originalType
		if origType, hasOrigType := elemMap["originalType"].(string); hasOrigType && origType != "" {
			elementType = origType
			elemMap["type"] = elementType
			fmt.Printf("Использован originalType в качестве type для элемента: %s\n", elementType)
		} else {
			elementType = "rectangle" // Тип по умолчанию
			elemMap["type"] = elementType
			fmt.Printf("Использован тип по умолчанию для элемента: %s\n", elementID)
		}
	}

	// Проверяем наличие и корректность позиции
	position, hasPosition := elemMap["position"].(map[string]interface{})
	if !hasPosition {
		elemMap["position"] = map[string]interface{}{
			"x": float64(100),
			"y": float64(100),
		}
	} else {
		// Преобразуем значения позиции в float64
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

	// Проверяем наличие и корректность размера
	size, hasSize := elemMap["size"].(map[string]interface{})
	if !hasSize {
		elemMap["size"] = map[string]interface{}{
			"width":  float64(100),
			"height": float64(100),
		}
	} else {
		// Преобразуем значения размера в float64
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

	// Проверяем наличие стиля
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
		// Проверяем наличие необходимых полей стиля
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

// KeyframeRef представляет ссылку на ключевой кадр
type KeyframeRef struct {
	KeyframeID primitive.ObjectID `json:"keyframeId" bson:"keyframeId"`
	Timestamp  float64            `json:"timestamp" bson:"timestamp"`
	Label      string             `json:"label,omitempty" bson:"label,omitempty"`
}

// ProjectCreateInput представляет входные данные для создания проекта
type ProjectCreateInput struct {
	Name          string         `json:"name" binding:"required"`
	Description   string         `json:"description"`
	TeamID        string         `json:"teamId,omitempty"`
	Tags          []string       `json:"tags,omitempty"`
	Title         string         `json:"title"`
	IsPrivate     bool           `json:"isPrivate"`
	Duration      int            `json:"duration"`
	AudioURL      string         `json:"audioUrl,omitempty"`
	VideoURL      string         `json:"videoUrl,omitempty"`
	Elements      []interface{}  `json:"elements,omitempty"`
	GlbAnimations []GlbAnimation `json:"glbAnimations,omitempty"`
}

// ProjectUpdateInput представляет входные данные для обновления проекта
type ProjectUpdateInput struct {
	Name          string         `json:"name,omitempty"`
	Description   string         `json:"description,omitempty"`
	TeamID        string         `json:"teamId,omitempty"`
	VideoURL      string         `json:"videoUrl,omitempty"`
	Tags          []string       `json:"tags,omitempty"`
	Title         string         `json:"title,omitempty"`
	IsPrivate     *bool          `json:"isPrivate,omitempty"`
	Elements      []interface{}  `json:"elements,omitempty"`
	Duration      *int           `json:"duration,omitempty"`
	AudioURL      string         `json:"audioUrl,omitempty"`
	GlbAnimations []GlbAnimation `json:"glbAnimations,omitempty"`
} 