"""
Конфигурационные параметры для системы определения поз
"""

import os
from pathlib import Path

# Параметры модели
POSE_MODEL = "lite"  # lite | full | heavy
POSE_DELEGATE = "cpu"  # gpu | cpu

# Параметры изображения
TARGET_SIDE = 160  # Целевой размер стороны для нормализации
MAX_RESIZE_SIDE = 640  # Максимальный размер стороны для масштабирования
JPEG_Q = 70  # Качество JPEG сжатия
PNG_COMPRESSION = 3  # Уровень сжатия PNG

# Пути и директории
MODEL_DIR = ".models"  # Директория для хранения моделей

# Логирование
LOG_LEVEL = "INFO"  # DEBUG | INFO | WARNING | ERROR | CRITICAL

# Производительность
NUM_WORKERS = 2  # Количество рабочих потоков
CACHE_SIZE = 200  # Размер кэша кадров
MIN_FRAME_DIFF = 0.05  # Минимальная разница между кадрами
USE_ETAG = True  # Использовать ETag для кэширования
MAX_MEMORY_PERCENT = 80.0  # Максимальный процент использования памяти

# Параметры детекции
DETECTION_THRESHOLD = 0.05  # Порог уверенности для детекции поз

# Настройки сервера
HOST = "0.0.0.0"
PORT = 8000
WORKERS = NUM_WORKERS

# Настройки API
ALLOW_CORS = True
MAX_REQUESTS_PER_MINUTE = 300

# Настройки кэша
CACHE_SIZE = CACHE_SIZE
MIN_FRAME_DIFF = MIN_FRAME_DIFF

# Пути к файлам
BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = Path(MODEL_DIR)

# Создаем директорию для моделей, если она не существует
MODEL_DIR.mkdir(exist_ok=True)

# URL для загрузки моделей
MODEL_VARIANTS = {
    "lite": "pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full": "pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}
BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/" 