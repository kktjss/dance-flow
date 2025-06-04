import sys
import os
import unittest
import numpy as np
import cv2
import tempfile
from unittest.mock import patch, MagicMock
import json

# Добавляем директорию server/python в путь, чтобы импорты работали
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../server/python')))

# Импортируем модуль video_processor
from video_analyzer import VideoProcessor  # type: ignore

class TestVideoProcessor(unittest.TestCase):
    
    def setUp(self):
        # Создаем временные тестовые файлы
        self.temp_dir = tempfile.TemporaryDirectory()
        
        # Создаем небольшое тестовое видео
        self.test_video_path = os.path.join(self.temp_dir.name, "test_video.mp4")
        self._create_test_video(self.test_video_path)
        
        # Создаем мок-модель для определения позы
        self.mock_model = MagicMock()
        self.mock_model.detect.return_value = {
            "poses": [{"x": 0.5, "y": 0.3, "z": 0.1, "v": 0.9}],  # Упрощенная поза
            "scores": [0.95]
        }
    
    def tearDown(self):
        # Очищаем временные файлы
        self.temp_dir.cleanup()
    
    def _create_test_video(self, path, frames=30, width=640, height=480):
        """Создаем простой тестовый видеофайл с движущимся прямоугольником"""
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # type: ignore
        writer = cv2.VideoWriter(path, fourcc, 15, (width, height))
        
        for i in range(frames):
            # Создаем пустой кадр
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            
            # Рисуем прямоугольник, движущийся слева направо
            x_pos = int(i * (width - 100) / frames)
            cv2.rectangle(frame, (x_pos, 200), (x_pos + 100, 300), (0, 255, 0), -1)
            
            # Добавляем кадр в видео
            writer.write(frame)
        
        writer.release()
    
    def test_video_processor_initialization(self):
        """Тест инициализации класса VideoProcessor"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Проверяем, что процессор был инициализирован правильно
        self.assertEqual(processor.video_path, self.test_video_path)
        self.assertIsNotNone(processor.cap)
        self.assertIsNotNone(processor.fps)
        self.assertIsNotNone(processor.total_frames)
        self.assertEqual(processor.model, self.mock_model)
    
    def test_video_processor_get_frame(self):
        """Тест получения конкретного кадра из видео"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Получаем первый кадр
        frame = processor.get_frame(0)
        
        # Проверяем размеры и тип кадра
        self.assertEqual(frame.shape, (480, 640, 3))
        self.assertEqual(frame.dtype, np.uint8)
        
        # Проверяем получение несуществующего кадра
        frame = processor.get_frame(-1)
        self.assertIsNone(frame)
        
        frame = processor.get_frame(1000)  # За пределами видео
        self.assertIsNone(frame)
    
    def test_video_processor_detect_poses_in_frame(self):
        """Тест определения поз на кадре"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        frame = processor.get_frame(0)
        
        # Определяем позы на кадре
        poses = processor.detect_poses_in_frame(frame)
        
        # Проверяем, что мок-модель была вызвана и вернула ожидаемый результат
        self.mock_model.detect.assert_called_once_with(frame)
        self.assertEqual(poses, {
            "poses": [{"x": 0.5, "y": 0.3, "z": 0.1, "v": 0.9}],
            "scores": [0.95]
        })
    
    def test_video_processor_process_frames(self):
        """Тест обработки последовательности кадров"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Обрабатываем первые 5 кадров
        results = processor.process_frames(start_frame=0, end_frame=5)
        
        # Проверяем, что получили результаты для всех кадров
        self.assertEqual(len(results), 5)
        
        # Проверяем, что каждый результат имеет ожидаемую структуру
        for result in results:
            self.assertIn("poses", result)
            self.assertIn("scores", result)
            self.assertEqual(len(result["poses"]), 1)
            self.assertEqual(len(result["scores"]), 1)
    
    def test_video_processor_to_json(self):
        """Тест преобразования информации о видео в JSON"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Получаем JSON-представление
        json_data = processor.to_json()
        
        # Проверяем наличие всех необходимых полей
        self.assertIn("video_path", json_data)
        self.assertIn("fps", json_data)
        self.assertIn("total_frames", json_data)
        
        # Проверяем значения
        self.assertEqual(json_data["video_path"], self.test_video_path)
        self.assertEqual(json_data["fps"], 15.0)  # Как задано в _create_test_video
        self.assertEqual(json_data["total_frames"], 30)  # Как задано в _create_test_video
    
    def test_video_processor_close(self):
        """Тест закрытия ресурсов видео"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Проверяем, что cap открыт
        self.assertTrue(processor.cap.isOpened())
        
        # Закрываем ресурсы
        processor.close()
        
        # Проверяем, что cap закрыт
        self.assertFalse(processor.cap.isOpened())

if __name__ == '__main__':
    unittest.main() 