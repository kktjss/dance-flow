import os
import sys
import unittest
import requests
import json
from unittest.mock import patch, MagicMock

# Добавляем путь к модулям проекта
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../server/python')))

# Предполагаем, что в проекте есть клиент API
class ApiClient:
    """Клиент для взаимодействия с API Dance Flow."""
    
    def __init__(self, base_url="http://localhost:5000", token=None):
        self.base_url = base_url
        self.token = token
        self.headers = {}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
    
    def set_token(self, token):
        """Установить токен авторизации."""
        self.token = token
        self.headers["Authorization"] = f"Bearer {token}"
    
    def login(self, username, password):
        """Аутентификация пользователя."""
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"username": username, "password": password}
        )
        if response.status_code == 200:
            data = response.json()
            self.set_token(data["token"])
            return data
        return None
    
    def register(self, username, email, password):
        """Регистрация нового пользователя."""
        response = requests.post(
            f"{self.base_url}/api/auth/register",
            json={"username": username, "email": email, "password": password}
        )
        return response.json() if response.status_code == 201 else None
    
    def get_projects(self):
        """Получение списка проектов."""
        response = requests.get(
            f"{self.base_url}/api/projects",
            headers=self.headers
        )
        return response.json() if response.status_code == 200 else None
    
    def create_project(self, name, description, is_private=False, tags=None):
        """Создание нового проекта."""
        if tags is None:
            tags = []
        
        response = requests.post(
            f"{self.base_url}/api/projects",
            headers=self.headers,
            json={
                "name": name,
                "description": description,
                "isPrivate": is_private,
                "tags": tags
            }
        )
        return response.json() if response.status_code == 201 else None
    
    def get_project(self, project_id):
        """Получение проекта по ID."""
        response = requests.get(
            f"{self.base_url}/api/projects/{project_id}",
            headers=self.headers
        )
        return response.json() if response.status_code == 200 else None
    
    def update_project(self, project_id, data):
        """Обновление проекта."""
        response = requests.put(
            f"{self.base_url}/api/projects/{project_id}",
            headers=self.headers,
            json=data
        )
        return response.json() if response.status_code == 200 else None
    
    def delete_project(self, project_id):
        """Удаление проекта."""
        response = requests.delete(
            f"{self.base_url}/api/projects/{project_id}",
            headers=self.headers
        )
        return response.json() if response.status_code == 200 else None


class TestApiClient(unittest.TestCase):
    """Интеграционные тесты для API клиента."""
    
    @classmethod
    def setUpClass(cls):
        """Настройка перед всеми тестами."""
        # Используем тестовый сервер или мок
        cls.base_url = os.environ.get("TEST_API_URL", "http://localhost:5000")
        cls.client = ApiClient(cls.base_url)
        
        # Создаем тестового пользователя
        cls.test_username = f"testuser_{os.urandom(4).hex()}"
        cls.test_email = f"{cls.test_username}@example.com"
        cls.test_password = "password123"
    
    def setUp(self):
        """Настройка перед каждым тестом."""
        # В реальном тесте мы бы использовали реальный API,
        # но для демонстрации будем использовать моки
        self.mock_response = MagicMock()
        self.mock_response.status_code = 200
        
        # Патчим requests.post и requests.get
        self.patcher_post = patch('requests.post', return_value=self.mock_response)
        self.patcher_get = patch('requests.get', return_value=self.mock_response)
        self.patcher_put = patch('requests.put', return_value=self.mock_response)
        self.patcher_delete = patch('requests.delete', return_value=self.mock_response)
        
        self.mock_post = self.patcher_post.start()
        self.mock_get = self.patcher_get.start()
        self.mock_put = self.patcher_put.start()
        self.mock_delete = self.patcher_delete.start()
    
    def tearDown(self):
        """Очистка после каждого теста."""
        self.patcher_post.stop()
        self.patcher_get.stop()
        self.patcher_put.stop()
        self.patcher_delete.stop()
    
    def test_login(self):
        """Тест аутентификации."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "token": "test_token",
            "user": {
                "_id": "user123",
                "username": self.test_username
            }
        }
        
        # Вызываем метод логина
        result = self.client.login(self.test_username, self.test_password)
        
        # Проверяем, что requests.post был вызван с правильными параметрами
        self.mock_post.assert_called_once_with(
            f"{self.base_url}/api/auth/login",
            json={"username": self.test_username, "password": self.test_password}
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertEqual(result["token"], "test_token")
        self.assertEqual(result["user"]["username"], self.test_username)
        
        # Проверяем, что токен был установлен
        self.assertEqual(self.client.token, "test_token")
        self.assertEqual(self.client.headers["Authorization"], "Bearer test_token")
    
    def test_register(self):
        """Тест регистрации."""
        # Настраиваем мок для ответа
        self.mock_response.status_code = 201
        self.mock_response.json.return_value = {
            "user": {
                "_id": "user123",
                "username": self.test_username,
                "email": self.test_email
            }
        }
        
        # Вызываем метод регистрации
        result = self.client.register(self.test_username, self.test_email, self.test_password)
        
        # Проверяем, что requests.post был вызван с правильными параметрами
        self.mock_post.assert_called_once_with(
            f"{self.base_url}/api/auth/register",
            json={
                "username": self.test_username,
                "email": self.test_email,
                "password": self.test_password
            }
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertEqual(result["user"]["username"], self.test_username)
        self.assertEqual(result["user"]["email"], self.test_email)
    
    def test_get_projects(self):
        """Тест получения проектов."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = [
            {
                "_id": "project1",
                "name": "Project 1",
                "description": "Description 1"
            },
            {
                "_id": "project2",
                "name": "Project 2",
                "description": "Description 2"
            }
        ]
        
        # Устанавливаем токен
        self.client.set_token("test_token")
        
        # Вызываем метод получения проектов
        result = self.client.get_projects()
        
        # Проверяем, что requests.get был вызван с правильными параметрами
        self.mock_get.assert_called_once_with(
            f"{self.base_url}/api/projects",
            headers={"Authorization": "Bearer test_token"}
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "Project 1")
        self.assertEqual(result[1]["name"], "Project 2")
    
    def test_create_project(self):
        """Тест создания проекта."""
        # Настраиваем мок для ответа
        self.mock_response.status_code = 201
        self.mock_response.json.return_value = {
            "_id": "newproject",
            "name": "New Project",
            "description": "New Description",
            "isPrivate": False,
            "tags": ["test", "new"]
        }
        
        # Устанавливаем токен
        self.client.set_token("test_token")
        
        # Вызываем метод создания проекта
        result = self.client.create_project(
            "New Project",
            "New Description",
            False,
            ["test", "new"]
        )
        
        # Проверяем, что requests.post был вызван с правильными параметрами
        self.mock_post.assert_called_once_with(
            f"{self.base_url}/api/projects",
            headers={"Authorization": "Bearer test_token"},
            json={
                "name": "New Project",
                "description": "New Description",
                "isPrivate": False,
                "tags": ["test", "new"]
            }
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "New Project")
        self.assertEqual(result["description"], "New Description")
        self.assertEqual(result["tags"], ["test", "new"])
    
    def test_update_project(self):
        """Тест обновления проекта."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "_id": "project1",
            "name": "Updated Project",
            "description": "Updated Description"
        }
        
        # Устанавливаем токен
        self.client.set_token("test_token")
        
        # Данные для обновления
        update_data = {
            "name": "Updated Project",
            "description": "Updated Description"
        }
        
        # Вызываем метод обновления проекта
        result = self.client.update_project("project1", update_data)
        
        # Проверяем, что requests.put был вызван с правильными параметрами
        self.mock_put.assert_called_once_with(
            f"{self.base_url}/api/projects/project1",
            headers={"Authorization": "Bearer test_token"},
            json=update_data
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], "Updated Project")
        self.assertEqual(result["description"], "Updated Description")
    
    def test_delete_project(self):
        """Тест удаления проекта."""
        # Настраиваем мок для ответа
        self.mock_response.json.return_value = {
            "message": "Project deleted successfully"
        }
        
        # Устанавливаем токен
        self.client.set_token("test_token")
        
        # Вызываем метод удаления проекта
        result = self.client.delete_project("project1")
        
        # Проверяем, что requests.delete был вызван с правильными параметрами
        self.mock_delete.assert_called_once_with(
            f"{self.base_url}/api/projects/project1",
            headers={"Authorization": "Bearer test_token"}
        )
        
        # Проверяем результат
        self.assertIsNotNone(result)
        self.assertIn("message", result)
        self.assertIn("deleted", result["message"])


if __name__ == '__main__':
    unittest.main() 