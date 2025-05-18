import os
import sys
import unittest
import json
import requests
from unittest.mock import patch, MagicMock

# Добавляем путь к модулям проекта
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../server/python')))

# Предполагаем, что в проекте есть класс для работы с внешним API
class ExternalAPI:
    """Клиент для взаимодействия с внешним API для анализа движений."""
    
    def __init__(self, api_key=None, base_url="https://api.example.com/v1"):
        self.base_url = base_url
        self.api_key = api_key or os.environ.get("EXTERNAL_API_KEY")
        if not self.api_key:
            raise ValueError("API key is required")
    
    def get_dance_categories(self):
        """Получение категорий танцев."""
        url = f"{self.base_url}/dance_categories"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            return response.json()
        else:
            error = response.json().get("error", "Unknown error")
            raise Exception(f"Failed to get dance categories: {error}")
    
    def analyze_dance_movement(self, video_data, dance_category):
        """Анализ танцевального движения."""
        url = f"{self.base_url}/analyze_dance"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "video_data": video_data,
            "dance_category": dance_category
        }
        
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code == 200:
            return response.json()
        else:
            error = response.json().get("error", "Unknown error")
            raise Exception(f"Failed to analyze dance movement: {error}")
    
    def get_reference_movements(self, dance_category, limit=10):
        """Получение эталонных движений по категории."""
        url = f"{self.base_url}/reference_movements"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {"category": dance_category, "limit": limit}
        
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            error = response.json().get("error", "Unknown error")
            raise Exception(f"Failed to get reference movements: {error}")


class TestExternalAPI(unittest.TestCase):
    """Интеграционные тесты для взаимодействия с внешним API."""
    
    @classmethod
    def setUpClass(cls):
        """Настройка перед всеми тестами."""
        # Проверяем наличие переменной окружения с API ключом
        cls.api_key = os.environ.get("EXTERNAL_API_KEY", "test_api_key")
        cls.base_url = os.environ.get("EXTERNAL_API_URL", "https://api.example.com/v1")
        
        # Инициализируем клиент API
        cls.api_client = ExternalAPI(api_key=cls.api_key, base_url=cls.base_url)
        
        # Подготавливаем тестовые данные
        # В реальном тесте здесь мог бы быть путь к видео-файлу
        test_data_path = os.path.join(os.path.dirname(__file__), "../fixtures/sample_data.json")
        if os.path.exists(test_data_path):
            with open(test_data_path, "r") as f:
                cls.test_data = json.load(f)
        else:
            # Если файл не существует, используем заглушку
            cls.test_data = {
                "video_data": "base64_encoded_sample_video_data",
                "dance_categories": ["salsa", "bachata", "kizomba", "tango", "hiphop"]
            }
    
    def setUp(self):
        """Подготовка перед каждым тестом."""
        # В реальном тесте мы бы использовали реальный API,
        # но для демонстрации будем использовать моки
        self.mock_response = MagicMock()
        self.mock_response.status_code = 200
        
        # Патчим requests.get и requests.post
        self.patcher_get = patch('requests.get', return_value=self.mock_response)
        self.patcher_post = patch('requests.post', return_value=self.mock_response)
        
        self.mock_get = self.patcher_get.start()
        self.mock_post = self.patcher_post.start()
    
    def tearDown(self):
        """Очистка после каждого теста."""
        self.patcher_get.stop()
        self.patcher_post.stop()
    
    def test_get_dance_categories(self):
        """Тест получения категорий танцев."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "categories": self.test_data["dance_categories"]
        }
        
        # Вызываем метод получения категорий танцев
        result = self.api_client.get_dance_categories()
        
        # Проверяем, что был сделан правильный запрос
        self.mock_get.assert_called_once_with(
            f"{self.base_url}/dance_categories",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        
        # Проверяем результат
        self.assertIn("categories", result)
        self.assertEqual(result["categories"], self.test_data["dance_categories"])
    
    def test_analyze_dance_movement(self):
        """Тест анализа танцевального движения."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "score": 85.5,
            "feedback": "Good movement, but try to keep your posture more upright.",
            "key_points": [
                {"timestamp": 0.5, "score": 75.0, "comment": "Need improvement"},
                {"timestamp": 1.2, "score": 90.0, "comment": "Excellent execution"},
                {"timestamp": 2.0, "score": 85.0, "comment": "Good timing"}
            ]
        }
        
        # Вызываем метод анализа движения
        result = self.api_client.analyze_dance_movement(
            self.test_data["video_data"], 
            "salsa"
        )
        
        # Проверяем, что был сделан правильный запрос
        self.mock_post.assert_called_once_with(
            f"{self.base_url}/analyze_dance",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "video_data": self.test_data["video_data"],
                "dance_category": "salsa"
            }
        )
        
        # Проверяем результат
        self.assertIn("score", result)
        self.assertIn("feedback", result)
        self.assertIn("key_points", result)
        self.assertIsInstance(result["score"], float)
        self.assertEqual(len(result["key_points"]), 3)
    
    def test_get_reference_movements(self):
        """Тест получения эталонных движений."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "movements": [
                {
                    "id": "mvt1",
                    "name": "Basic Step",
                    "category": "salsa",
                    "difficulty": "beginner",
                    "video_url": "https://example.com/videos/salsa_basic.mp4"
                },
                {
                    "id": "mvt2",
                    "name": "Right Turn",
                    "category": "salsa",
                    "difficulty": "beginner",
                    "video_url": "https://example.com/videos/salsa_right_turn.mp4"
                }
            ]
        }
        
        # Вызываем метод получения эталонных движений
        result = self.api_client.get_reference_movements("salsa", 2)
        
        # Проверяем, что был сделан правильный запрос
        self.mock_get.assert_called_once_with(
            f"{self.base_url}/reference_movements",
            headers={"Authorization": f"Bearer {self.api_key}"},
            params={"category": "salsa", "limit": 2}
        )
        
        # Проверяем результат
        self.assertIn("movements", result)
        self.assertEqual(len(result["movements"]), 2)
        self.assertEqual(result["movements"][0]["category"], "salsa")
        self.assertEqual(result["movements"][1]["name"], "Right Turn")
    
    def test_error_handling(self):
        """Тест обработки ошибок API."""
        # Настраиваем мок для ответа с ошибкой
        self.mock_response.status_code = 401
        self.mock_response.json.return_value = {
            "error": "Invalid API key"
        }
        
        # Проверяем, что вызов метода вызывает исключение
        with self.assertRaises(Exception) as context:
            self.api_client.get_dance_categories()
        
        # Проверяем сообщение об ошибке
        self.assertIn("Invalid API key", str(context.exception))
    
    @patch.dict(os.environ, {}, clear=True)
    def test_missing_api_key(self):
        """Тест отсутствия API ключа."""
        # Проверяем, что создание клиента без API ключа вызывает исключение
        with self.assertRaises(ValueError) as context:
            ExternalAPI()
        
        # Проверяем сообщение об ошибке
        self.assertIn("API key is required", str(context.exception))
    
    @unittest.skipIf("LIVE_API_TEST" not in os.environ, "Skipping live API test")
    def test_live_api(self):
        """Тест с реальным API (запускается только если установлена переменная LIVE_API_TEST)."""
        # Этот тест будет использовать реальное API вместо моков
        # Удаляем все патчи
        self.patcher_get.stop()
        self.patcher_post.stop()
        
        # Получаем категории танцев
        categories = self.api_client.get_dance_categories()
        self.assertIn("categories", categories)
        self.assertIsInstance(categories["categories"], list)
        
        # Сбрасываем патчи для остальных тестов
        self.mock_get = self.patcher_get.start()
        self.mock_post = self.patcher_post.start()


if __name__ == '__main__':
    unittest.main() 