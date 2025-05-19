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
from video_analyzer.video_processor import (
    VideoProcessor, extract_video_frames, compare_poses, calculate_pose_similarity,
    analyze_dance_video, process_comparison
)

class TestVideoProcessor(unittest.TestCase):
    
    def setUp(self):
        # Создаем временные тестовые файлы
        self.temp_dir = tempfile.TemporaryDirectory()
        
        # Создаем небольшое тестовое видео
        self.test_video_path = os.path.join(self.temp_dir.name, "test_video.mp4")
        self._create_test_video(self.test_video_path)
        
        # Создаем образцы поз для тестирования
        self.pose1 = [
            {"x": 0.5, "y": 0.3, "z": 0.1, "v": 0.9},  # Нос
            {"x": 0.51, "y": 0.31, "z": 0.11, "v": 0.9},  # Левый глаз
            {"x": 0.49, "y": 0.31, "z": 0.11, "v": 0.9},  # Правый глаз
            # Для реальной позы нужно добавить больше ключевых точек
        ]
        
        self.pose2 = [
            {"x": 0.52, "y": 0.32, "z": 0.12, "v": 0.9},  # Нос - слегка отличается
            {"x": 0.53, "y": 0.33, "z": 0.13, "v": 0.9},  # Левый глаз
            {"x": 0.51, "y": 0.33, "z": 0.13, "v": 0.9},  # Правый глаз
            # Для реальной позы нужно добавить больше ключевых точек
        ]
        
        # Создаем мок-модель для определения позы
        self.mock_model = MagicMock()
        self.mock_model.detect.return_value = {
            "poses": [self.pose1],
            "scores": [0.95]
        }
    
    def tearDown(self):
        # Очищаем временные файлы
        self.temp_dir.cleanup()
    
    def _create_test_video(self, path, frames=30, width=640, height=480):
        """Создаем простой тестовый видеофайл с движущимся прямоугольником"""
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
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
    
    def test_extract_video_frames(self):
        """Тест извлечения кадров из видеофайла"""
        frames = extract_video_frames(self.test_video_path, max_frames=10)
        
        # Проверяем, что получили ожидаемое количество кадров
        self.assertLessEqual(len(frames), 10)
        
        # Проверяем, что кадры имеют ожидаемую форму
        self.assertEqual(frames[0].shape, (480, 640, 3))
    
    def test_compare_poses(self):
        """Тест сравнения двух поз на схожесть"""
        similarity = compare_poses(self.pose1, self.pose2)
        
        # Позы слегка отличаются, поэтому схожесть должна быть < 1.0, но > 0
        self.assertLess(similarity, 1.0)
        self.assertGreater(similarity, 0.0)
        
        # Одинаковые позы должны быть идеально схожи
        self.assertEqual(compare_poses(self.pose1, self.pose1), 1.0)
    
    def test_calculate_pose_similarity(self):
        """Тест расчета схожести поз с разными весами"""
        # Определяем веса для разных частей тела
        weights = {
            "upper_body": 0.6,
            "lower_body": 0.4
        }
        
        similarity = calculate_pose_similarity(self.pose1, self.pose2, weights)
        
        # Схожесть должна быть значением между 0 и 1
        self.assertGreaterEqual(similarity, 0.0)
        self.assertLessEqual(similarity, 1.0)
    
    @patch('video_analyzer.video_processor.extract_video_frames')
    def test_analyze_dance_video(self, mock_extract_frames):
        """Тест анализа танцевального видео по сравнению с эталоном"""
        # Мок извлечения кадров, возвращающий последовательность из 5 кадров
        mock_frames = [np.zeros((480, 640, 3), dtype=np.uint8) for _ in range(5)]
        mock_extract_frames.return_value = mock_frames
        
        # Мок-модель определения позы
        mock_model = MagicMock()
        mock_model.detect.return_value = {
            "poses": [self.pose1],
            "scores": [0.95]
        }
        
        # Создаем путь к эталонному видео
        ref_video_path = os.path.join(self.temp_dir.name, "reference.mp4")
        self._create_test_video(ref_video_path)
        
        # Анализируем танцевальное видео
        results = analyze_dance_video(
            self.test_video_path, 
            ref_video_path,
            model=mock_model,
            sample_rate=1.0
        )
        
        # Проверяем структуру результатов
        self.assertIn("overall_score", results)
        self.assertIn("timing", results)
        self.assertIn("technique", results)
        self.assertIn("frame_scores", results)
        
        # Проверяем, что общий балл находится между 0 и 100
        self.assertGreaterEqual(results["overall_score"], 0)
        self.assertLessEqual(results["overall_score"], 100)
        
        # Баллы за тайминг и технику должны быть между 0 и 100
        self.assertGreaterEqual(results["timing"]["score"], 0)
        self.assertLessEqual(results["timing"]["score"], 100)
        self.assertGreaterEqual(results["technique"]["score"], 0)
        self.assertLessEqual(results["technique"]["score"], 100)
        
        # Должны быть извлечены кадры из обоих видео
        self.assertEqual(mock_extract_frames.call_count, 2)
    
    def test_process_comparison(self):
        """Тест обработки сравнения между позами танцора и эталонными позами"""
        # Создаем искусственные синхронизированные последовательности поз танцора и эталона
        dance_sequence = [self.pose1, self.pose2, self.pose1] * 3
        reference_sequence = [self.pose1, self.pose1, self.pose2] * 3
        
        # Обрабатываем сравнение между последовательностями
        result = process_comparison(
            dance_sequence, 
            reference_sequence,
            fps=15.0
        )
        
        # Проверяем структуру результатов
        self.assertIn("frame_scores", result)
        self.assertIn("timing_score", result)
        self.assertIn("technique_score", result)
        self.assertIn("overall_score", result)
        
        # Проверяем, что баллы находятся между 0 и 100
        self.assertGreaterEqual(result["overall_score"], 0)
        self.assertLessEqual(result["overall_score"], 100)
        self.assertGreaterEqual(result["timing_score"], 0)
        self.assertLessEqual(result["timing_score"], 100)
        self.assertGreaterEqual(result["technique_score"], 0)
        self.assertLessEqual(result["technique_score"], 100)
        
        # Должны быть оценки кадров для каждого кадра
        self.assertEqual(len(result["frame_scores"]), len(dance_sequence))
    
    def test_video_processor_get_frame(self):
        """Тест получения конкретного кадра из видео"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Получаем первый кадр
        frame = processor.get_frame(0)
        
        # Проверяем, что кадр имеет правильную форму
        self.assertEqual(frame.shape, (480, 640, 3))
        
        # Проверяем, что кадр не пустой
        self.assertGreater(np.sum(frame), 0)
    
    def test_video_processor_detect_poses_in_frame(self):
        """Тест обнаружения поз в конкретном кадре"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Получаем кадр и определяем позы
        frame = processor.get_frame(0)
        poses = processor.detect_poses_in_frame(frame)
        
        # Проверяем результат
        self.assertIsInstance(poses, list)
        self.assertEqual(len(poses), 1)  # Должна быть одна поза
        self.assertEqual(poses[0], self.pose1)  # Должна соответствовать нашей тестовой позе
    
    def test_video_processor_process_frames(self):
        """Тест обработки нескольких кадров видео"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Обрабатываем первые 5 кадров
        results = processor.process_frames(max_frames=5)
        
        # Проверяем результаты
        self.assertIsInstance(results, list)
        self.assertLessEqual(len(results), 5)
        
        # Каждый результат должен содержать кадр и позы
        for result in results:
            self.assertIn('frame', result)
            self.assertIn('poses', result)
            self.assertIsInstance(result['poses'], list)
    
    def test_video_processor_to_json(self):
        """Тест преобразования результатов в формат JSON"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Создаем тестовые результаты
        results = [
            {
                'frame': np.zeros((480, 640, 3), dtype=np.uint8),
                'frame_idx': 0,
                'poses': [self.pose1],
                'scores': [0.95]
            },
            {
                'frame': np.zeros((480, 640, 3), dtype=np.uint8),
                'frame_idx': 1,
                'poses': [self.pose2],
                'scores': [0.9]
            }
        ]
        
        # Преобразуем в JSON
        json_data = processor.to_json(results)
        
        # Проверяем, что результат можно преобразовать в JSON
        self.assertIsInstance(json_data, str)
        parsed = json.loads(json_data)
        self.assertEqual(len(parsed), 2)
    
    def test_video_processor_close(self):
        """Тест корректного закрытия процессора видео"""
        processor = VideoProcessor(model=self.mock_model, video_path=self.test_video_path)
        
        # Закрываем процессор
        processor.close()
        
        # Проверяем, что параметры были сброшены
        self.assertIsNone(processor.cap)

if __name__ == '__main__':
    unittest.main() 