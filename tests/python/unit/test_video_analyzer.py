import os
import sys
import unittest
import numpy as np
from unittest.mock import patch, MagicMock

# Добавляем путь к модулям проекта
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../server/python')))

# Импортируем тестируемые модули
from video_analyzer.pose_detector import PoseDetector
from video_analyzer.motion_analyzer import MotionAnalyzer


class TestPoseDetector(unittest.TestCase):
    """Тесты для модуля определения поз."""
    
    def setUp(self):
        """Подготовка окружения перед каждым тестом."""
        self.detector = PoseDetector()
        
    @patch('video_analyzer.pose_detector.cv2.VideoCapture')
    def test_load_video(self, mock_video_capture):
        """Тест загрузки видео."""
        # Arrange
        mock_instance = MagicMock()
        mock_video_capture.return_value = mock_instance
        mock_instance.isOpened.return_value = True
        mock_instance.get.side_effect = lambda x: 30.0 if x == 5 else 1280 if x == 3 else 720 if x == 4 else 0
        
        # Act
        result = self.detector.load_video("test_video.mp4")
        
        # Assert
        self.assertTrue(result)
        mock_video_capture.assert_called_once_with("test_video.mp4")
        mock_instance.isOpened.assert_called_once()
    
    @patch('video_analyzer.pose_detector.cv2.VideoCapture')
    def test_load_video_failure(self, mock_video_capture):
        """Тест обработки ошибки при загрузке видео."""
        # Arrange
        mock_instance = MagicMock()
        mock_video_capture.return_value = mock_instance
        mock_instance.isOpened.return_value = False
        
        # Act
        result = self.detector.load_video("nonexistent_video.mp4")
        
        # Assert
        self.assertFalse(result)
    
    @patch('video_analyzer.pose_detector.mediapipe.solutions.pose.Pose')
    def test_detect_poses(self, mock_pose):
        """Тест обнаружения поз в кадре."""
        # Arrange
        mock_pose_instance = MagicMock()
        mock_pose.return_value = mock_pose_instance
        
        # Создаем тестовый кадр
        test_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        
        # Создаем имитацию результата распознавания позы
        mock_result = MagicMock()
        mock_pose_instance.process.return_value = mock_result
        mock_result.pose_landmarks = MagicMock()
        
        # Act
        landmarks = self.detector.detect_pose(test_frame)
        
        # Assert
        self.assertIsNotNone(landmarks)
        mock_pose_instance.process.assert_called_once()
    
    @patch('video_analyzer.pose_detector.mediapipe.solutions.pose.Pose')
    def test_detect_poses_no_detection(self, mock_pose):
        """Тест случая, когда поза не обнаружена."""
        # Arrange
        mock_pose_instance = MagicMock()
        mock_pose.return_value = mock_pose_instance
        
        # Создаем тестовый кадр
        test_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        
        # Создаем имитацию результата без распознавания позы
        mock_result = MagicMock()
        mock_pose_instance.process.return_value = mock_result
        mock_result.pose_landmarks = None
        
        # Act
        landmarks = self.detector.detect_pose(test_frame)
        
        # Assert
        self.assertIsNone(landmarks)
        mock_pose_instance.process.assert_called_once()


class TestMotionAnalyzer(unittest.TestCase):
    """Тесты для модуля анализа движений."""
    
    def setUp(self):
        """Подготовка окружения перед каждым тестом."""
        self.analyzer = MotionAnalyzer()
    
    def test_calculate_joint_angles(self):
        """Тест расчета углов между суставами."""
        # Arrange
        # Создаем имитацию данных о координатах ключевых точек
        landmarks = MagicMock()
        # Настраиваем точки для плечевого сустава (плечо-локоть-запястье)
        landmarks.landmark = [
            MagicMock(x=0.5, y=0.5, z=0),  # Плечо
            MagicMock(x=0.6, y=0.6, z=0),  # Локоть
            MagicMock(x=0.7, y=0.5, z=0)   # Запястье
        ]
        
        # Act
        angle = self.analyzer.calculate_angle(landmarks, 0, 1, 2)
        
        # Assert
        # Ожидаемый угол ~90 градусов с небольшой погрешностью
        self.assertAlmostEqual(angle, 90.0, delta=5.0)
    
    def test_analyze_movement_quality(self):
        """Тест анализа качества движения."""
        # Arrange
        reference_angles = [90.0, 120.0, 150.0]
        user_angles = [85.0, 125.0, 145.0]
        
        # Act
        score = self.analyzer.calculate_movement_score(reference_angles, user_angles)
        
        # Assert
        # Проверяем, что оценка находится в допустимом диапазоне
        self.assertGreaterEqual(score, 0.0)
        self.assertLessEqual(score, 100.0)
        # Проверяем, что оценка высокая для близких значений
        self.assertGreaterEqual(score, 80.0)


if __name__ == '__main__':
    unittest.main() 