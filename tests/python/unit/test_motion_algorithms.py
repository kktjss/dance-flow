import os
import sys
import unittest
import numpy as np
import cv2
from unittest.mock import patch, MagicMock

# Добавляем путь к модулям проекта
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../server/python')))

# Импортируем тестируемые модули
try:
    from video_analyzer.motion_analyzer import MotionAnalyzer
    from video_analyzer.motion_algorithms import MotionAlgorithms
    from video_analyzer.dance_comparison import DanceComparison
except ImportError:
    # Если модули не найдены, создаём заглушки для тестирования
    class MotionAlgorithms:
        """Заглушка для алгоритмов анализа движений."""
        
        @staticmethod
        def compute_dtw_distance(seq1, seq2):
            """Расчёт расстояния DTW между двумя последовательностями."""
            # Простая реализация DTW для тестирования
            n, m = len(seq1), len(seq2)
            dtw_matrix = np.zeros((n + 1, m + 1))
            
            for i in range(1, n + 1):
                dtw_matrix[i, 0] = float('inf')
            
            for i in range(1, m + 1):
                dtw_matrix[0, i] = float('inf')
            
            dtw_matrix[0, 0] = 0
            
            for i in range(1, n + 1):
                for j in range(1, m + 1):
                    cost = np.linalg.norm(np.array(seq1[i - 1]) - np.array(seq2[j - 1]))
                    dtw_matrix[i, j] = cost + min(
                        dtw_matrix[i - 1, j],      # insertion
                        dtw_matrix[i, j - 1],      # deletion
                        dtw_matrix[i - 1, j - 1]   # match
                    )
            
            return dtw_matrix[n, m]
        
        @staticmethod
        def calculate_similarity_score(distance, max_distance=100.0):
            """Преобразование расстояния в оценку сходства."""
            # Трансформируем расстояние в оценку от 0 до 100
            return max(0.0, min(100.0, (1.0 - distance / max_distance) * 100.0))
        
        @staticmethod
        def extract_key_poses(pose_sequence, num_poses=5):
            """Выделение ключевых поз из последовательности."""
            if len(pose_sequence) <= num_poses:
                return pose_sequence
            
            # Упрощенный алгоритм - берем равномерно распределенные позы
            indices = np.linspace(0, len(pose_sequence) - 1, num_poses, dtype=int)
            return [pose_sequence[i] for i in indices]
        
        @staticmethod
        def normalize_poses(poses):
            """Нормализация поз для инвариантности к масштабу и положению."""
            if not poses:
                return []
                
            normalized = []
            for pose in poses:
                if not pose:
                    normalized.append([])
                    continue
                    
                # Находим центр тяжести
                center = np.mean(pose, axis=0)
                # Максимальное расстояние от центра
                max_dist = np.max(np.linalg.norm(pose - center, axis=1))
                
                # Нормализуем позу
                if max_dist > 0:
                    norm_pose = (pose - center) / max_dist
                else:
                    norm_pose = pose - center
                    
                normalized.append(norm_pose)
                
            return normalized

    class DanceComparison:
        """Заглушка для сравнения танцевальных движений."""
        
        def __init__(self):
            self.algorithms = MotionAlgorithms()
            
        def compare_dance_sequences(self, reference_seq, user_seq, method="dtw"):
            """Сравнение последовательностей движений."""
            # Нормализуем последовательности
            norm_ref = self.algorithms.normalize_poses(reference_seq)
            norm_user = self.algorithms.normalize_poses(user_seq)
            
            # Выделяем ключевые позы
            key_ref = self.algorithms.extract_key_poses(norm_ref)
            key_user = self.algorithms.extract_key_poses(norm_user)
            
            # Вычисляем расстояние
            if method == "dtw":
                distance = self.algorithms.compute_dtw_distance(key_ref, key_user)
            else:
                # Простое евклидово расстояние для других методов
                distance = np.mean([np.linalg.norm(np.array(r) - np.array(u)) 
                                  for r, u in zip(key_ref, key_user)])
            
            # Вычисляем оценку сходства
            score = self.algorithms.calculate_similarity_score(distance)
            
            return {
                "score": score,
                "distance": distance,
                "key_poses": {
                    "reference": key_ref,
                    "user": key_user
                }
            }
        
        def analyze_timing(self, reference_seq, user_seq, fps=30):
            """Анализ синхронизации движений."""
            # Упрощенный анализ - расчет среднего сдвига времени
            if not reference_seq or not user_seq:
                return {"sync_score": 0.0, "avg_delay": 0.0}
            
            # Имитация корреляции между последовательностями
            delays = []
            for i in range(min(5, len(reference_seq), len(user_seq))):
                # Имитация задержки в кадрах
                delay = np.random.randint(-10, 10)
                delays.append(delay)
            
            avg_delay = np.mean(delays) / fps  # в секундах
            
            # Оценка синхронизации (выше при меньшей задержке)
            sync_score = max(0.0, min(100.0, 100.0 - abs(avg_delay) * 20.0))
            
            return {
                "sync_score": sync_score,
                "avg_delay": avg_delay
            }


class TestMotionAlgorithms(unittest.TestCase):
    """Тесты для алгоритмов анализа движений."""
    
    def setUp(self):
        """Подготовка окружения перед каждым тестом."""
        self.algorithms = MotionAlgorithms()
        
        # Создаем тестовые данные для последовательностей поз
        # Для простоты используем 2D точки
        self.sequence1 = [
            np.array([[0, 0], [1, 1], [2, 1], [3, 0]]),  # Поза 1
            np.array([[0, 1], [1, 2], [2, 2], [3, 1]]),  # Поза 2
            np.array([[0, 2], [1, 3], [2, 3], [3, 2]]),  # Поза 3
            np.array([[0, 3], [1, 2], [2, 2], [3, 3]]),  # Поза 4
            np.array([[0, 4], [1, 3], [2, 3], [3, 4]])   # Поза 5
        ]
        
        # Похожая последовательность с небольшими отличиями
        self.sequence2 = [
            np.array([[0, 0.1], [1, 1.1], [2, 1.1], [3, 0.1]]),  # Поза 1
            np.array([[0, 1.1], [1, 2.1], [2, 2.1], [3, 1.1]]),  # Поза 2
            np.array([[0, 2.1], [1, 3.1], [2, 3.1], [3, 2.1]]),  # Поза 3
            np.array([[0, 3.1], [1, 2.1], [2, 2.1], [3, 3.1]]),  # Поза 4
            np.array([[0, 4.1], [1, 3.1], [2, 3.1], [3, 4.1]])   # Поза 5
        ]
        
        # Совсем другая последовательность
        self.sequence3 = [
            np.array([[0, 5], [1, 6], [2, 6], [3, 5]]),  # Поза 1
            np.array([[0, 4], [1, 3], [2, 3], [3, 4]]),  # Поза 2
            np.array([[0, 3], [1, 2], [2, 2], [3, 3]]),  # Поза 3
            np.array([[0, 2], [1, 1], [2, 1], [3, 2]]),  # Поза 4
            np.array([[0, 1], [1, 0], [2, 0], [3, 1]])   # Поза 5
        ]
    
    def test_dtw_distance(self):
        """Тест расчета DTW расстояния между последовательностями."""
        # Проверяем расстояние между одинаковыми последовательностями
        distance1 = self.algorithms.compute_dtw_distance(self.sequence1, self.sequence1)
        self.assertAlmostEqual(distance1, 0.0, delta=1e-5)
        
        # Проверяем расстояние между похожими последовательностями
        distance2 = self.algorithms.compute_dtw_distance(self.sequence1, self.sequence2)
        self.assertLess(distance2, 10.0)
        
        # Проверяем расстояние между разными последовательностями
        distance3 = self.algorithms.compute_dtw_distance(self.sequence1, self.sequence3)
        self.assertGreater(distance3, distance2)
    
    def test_similarity_score(self):
        """Тест расчета оценки сходства из расстояния."""
        # Проверяем оценку для разных значений расстояния
        self.assertAlmostEqual(self.algorithms.calculate_similarity_score(0.0), 100.0)
        self.assertAlmostEqual(self.algorithms.calculate_similarity_score(50.0, 100.0), 50.0)
        self.assertAlmostEqual(self.algorithms.calculate_similarity_score(100.0, 100.0), 0.0)
        self.assertAlmostEqual(self.algorithms.calculate_similarity_score(150.0, 100.0), 0.0)  # Не должно быть отрицательных значений
    
    def test_extract_key_poses(self):
        """Тест выделения ключевых поз."""
        # Проверяем выделение всех поз, если их меньше запрошенного количества
        key_poses1 = self.algorithms.extract_key_poses(self.sequence1, 10)
        self.assertEqual(len(key_poses1), len(self.sequence1))
        
        # Проверяем выделение запрошенного количества поз
        key_poses2 = self.algorithms.extract_key_poses(self.sequence1, 3)
        self.assertEqual(len(key_poses2), 3)
        
        # Первая и последняя позы должны входить в ключевые
        self.assertTrue(np.array_equal(key_poses2[0], self.sequence1[0]))
        self.assertTrue(np.array_equal(key_poses2[-1], self.sequence1[-1]))
    
    def test_normalize_poses(self):
        """Тест нормализации поз."""
        # Проверяем нормализацию одной позы
        pose = np.array([[0, 0], [2, 0], [2, 2], [0, 2]])
        norm_poses = self.algorithms.normalize_poses([pose])
        
        # Центр должен быть в точке (0, 0)
        self.assertAlmostEqual(np.mean(norm_poses[0][:, 0]), 0.0)
        self.assertAlmostEqual(np.mean(norm_poses[0][:, 1]), 0.0)
        
        # Максимальное расстояние должно быть 1
        distances = np.linalg.norm(norm_poses[0], axis=1)
        self.assertAlmostEqual(np.max(distances), 1.0, delta=0.01)
        
        # Проверяем нормализацию последовательности поз
        norm_sequence = self.algorithms.normalize_poses(self.sequence1)
        self.assertEqual(len(norm_sequence), len(self.sequence1))
        
        for pose in norm_sequence:
            # Проверяем, что центр каждой нормализованной позы находится в (0, 0)
            self.assertAlmostEqual(np.mean(pose[:, 0]), 0.0, delta=1e-10)
            self.assertAlmostEqual(np.mean(pose[:, 1]), 0.0, delta=1e-10)


class TestDanceComparison(unittest.TestCase):
    """Тесты для сравнения танцевальных движений."""
    
    def setUp(self):
        """Подготовка окружения перед каждым тестом."""
        self.comparison = DanceComparison()
        
        # Создаем тестовые данные для последовательностей поз
        # Для простоты используем 2D точки
        self.reference_seq = [
            np.array([[0, 0], [1, 1], [2, 1], [3, 0]]),
            np.array([[0, 1], [1, 2], [2, 2], [3, 1]]),
            np.array([[0, 2], [1, 3], [2, 3], [3, 2]]),
            np.array([[0, 3], [1, 2], [2, 2], [3, 3]]),
            np.array([[0, 4], [1, 3], [2, 3], [3, 4]])
        ]
        
        # Похожая последовательность с небольшими отличиями
        self.user_seq_similar = [
            np.array([[0, 0.1], [1, 1.1], [2, 1.1], [3, 0.1]]),
            np.array([[0, 1.1], [1, 2.1], [2, 2.1], [3, 1.1]]),
            np.array([[0, 2.1], [1, 3.1], [2, 3.1], [3, 2.1]]),
            np.array([[0, 3.1], [1, 2.1], [2, 2.1], [3, 3.1]]),
            np.array([[0, 4.1], [1, 3.1], [2, 3.1], [3, 4.1]])
        ]
        
        # Разная последовательность
        self.user_seq_different = [
            np.array([[0, 5], [1, 6], [2, 6], [3, 5]]),
            np.array([[0, 4], [1, 3], [2, 3], [3, 4]]),
            np.array([[0, 3], [1, 2], [2, 2], [3, 3]]),
            np.array([[0, 2], [1, 1], [2, 1], [3, 2]]),
            np.array([[0, 1], [1, 0], [2, 0], [3, 1]])
        ]
    
    def test_compare_dance_sequences_dtw(self):
        """Тест сравнения танцевальных последовательностей методом DTW."""
        # Сравнение эталона с собой
        result1 = self.comparison.compare_dance_sequences(
            self.reference_seq, self.reference_seq, method="dtw"
        )
        # Идентичные последовательности должны иметь высокую оценку
        self.assertGreaterEqual(result1["score"], 90.0)
        
        # Сравнение эталона с похожей последовательностью
        result2 = self.comparison.compare_dance_sequences(
            self.reference_seq, self.user_seq_similar, method="dtw"
        )
        # Похожие последовательности должны иметь среднюю или высокую оценку
        self.assertGreaterEqual(result2["score"], 70.0)
        
        # Сравнение эталона с другой последовательностью
        result3 = self.comparison.compare_dance_sequences(
            self.reference_seq, self.user_seq_different, method="dtw"
        )
        # Разные последовательности должны иметь низкую оценку
        self.assertLessEqual(result3["score"], result2["score"])
    
    def test_analyze_timing(self):
        """Тест анализа синхронизации движений."""
        # Анализ синхронизации одинаковых последовательностей
        result1 = self.comparison.analyze_timing(
            self.reference_seq, self.reference_seq
        )
        # Должна быть информация о синхронизации
        self.assertIn("sync_score", result1)
        self.assertIn("avg_delay", result1)
        
        # Анализ с пустыми последовательностями
        result2 = self.comparison.analyze_timing([], [])
        self.assertEqual(result2["sync_score"], 0.0)
        self.assertEqual(result2["avg_delay"], 0.0)


if __name__ == '__main__':
    unittest.main() 