"""
FastAPI + MediaPipe Tasks — API обнаружения поз **v3.1**
===========================================
* Обнаружение человека в режиме паузы видео
* Активно только в режиме "найти танцора"
* Пользователь кликает по области, код выделяет человека
"""

import asyncio
import base64
import itertools
import logging
import os
import time
import urllib.request
from pathlib import Path
from typing import Any, List, Dict, Tuple
import threading
import queue
from concurrent.futures import ThreadPoolExecutor
import functools
import hashlib
from collections import OrderedDict, deque
import math

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Query, Response, Header
from fastapi.middleware.cors import CORSMiddleware
import psutil  # Для мониторинга памяти
from fastapi.responses import JSONResponse

# ───────────────────────── Опциональный TurboJPEG ─────────────────────────
try:
    from turbojpeg import TurboJPEG, TJFLAG_FASTDCT

    _tj = TurboJPEG()

    def _encode_jpeg(img_bgr: np.ndarray, q: int) -> str:
        """Быстрое JPEG кодирование в base64 через libjpeg‑turbo."""
        return base64.b64encode(_tj.encode(img_bgr, quality=q, flags=TJFLAG_FASTDCT)).decode()

except ImportError:

    def _encode_jpeg(img_bgr: np.ndarray, q: int) -> str:
        ok, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), q])
        if not ok:
            raise RuntimeError("cv2.imencode failed")
        return base64.b64encode(buf).decode()


def _encode_png(img_bgra: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img_bgra, [cv2.IMWRITE_PNG_COMPRESSION, 3])  # Оптимизация сжатия PNG
    if not ok:
        raise RuntimeError("cv2.imencode(.png) failed")
    return base64.b64encode(buf).decode()

# ───────────────────────── MediaPipe ──────────────────────────
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.python import solutions
from mediapipe.python.solutions import drawing_utils, pose
from mediapipe.framework.formats import landmark_pb2

# Импорт утилит для рисования и позы
mp_drawing = drawing_utils
mp_pose = pose

# Пытаемся импортировать параметры конфигурации, в случае их отсутствия используем переменные окружения
try:
    from config.settings import (
        POSE_MODEL, POSE_DELEGATE, TARGET_SIDE, MAX_RESIZE_SIDE,
        JPEG_Q, PNG_COMPRESSION, MODEL_DIR, LOG_LEVEL,
        NUM_WORKERS, CACHE_SIZE, MIN_FRAME_DIFF, USE_ETAG,
        MAX_MEMORY_PERCENT, DETECTION_THRESHOLD
    )
except ImportError:
    # Запасной вариант с переменными окружения
    POSE_MODEL = os.getenv("POSE_MODEL", "lite")
    POSE_DELEGATE = os.getenv("POSE_DELEGATE", "gpu").lower()  # gpu | cpu
    TARGET_SIDE = int(os.getenv("TARGET_SIDE", "160"))
    MAX_RESIZE_SIDE = int(os.getenv("MAX_RESIZE_SIDE", "640"))
    JPEG_Q = int(os.getenv("JPEG_Q", "70"))
    PNG_COMPRESSION = int(os.getenv("PNG_COMPRESSION", "3"))
    MODEL_DIR = Path(os.getenv("MODEL_DIR", ".models"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
    NUM_WORKERS = int(os.getenv("NUM_WORKERS", "2"))
    CACHE_SIZE = int(os.getenv("CACHE_SIZE", "200"))
    MIN_FRAME_DIFF = float(os.getenv("MIN_FRAME_DIFF", "0.05"))
    USE_ETAG = os.getenv("USE_ETAG", "1") == "1"
    MAX_MEMORY_PERCENT = float(os.getenv("MAX_MEMORY_PERCENT", "80"))
    DETECTION_THRESHOLD = float(os.getenv("DETECTION_THRESHOLD", "0.05"))

# ----------------------------------------------------------------------------
# Пул обработки и очередь
# ----------------------------------------------------------------------------
frame_queue = queue.Queue(maxsize=30)  # Очередь для кадров, которые нужно обработать
result_cache = {}  # Кэш для результатов
frame_cache = OrderedDict()  # LRU кэш для хешей кадров и результатов
similarity_cache = {}  # Кэш для сравнения схожести между кадрами
performance_stats = {
    "processed_frames": 0,
    "cached_hits": 0,
    "processing_times": deque(maxlen=50),  # Отслеживаем последние 50 времен обработки
    "memory_usage": deque(maxlen=10),      # Отслеживаем использование памяти
}
pool = ThreadPoolExecutor(max_workers=NUM_WORKERS)

# Ограничитель частоты запросов для предотвращения перегрузки
rate_limiter = {
    "last_cleared": time.time(),
    "requests": {},  # IP -> количество
    "max_per_minute": 300,  # Максимальное количество запросов в минуту с одного IP
}

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pose_api")

# Правильные соединения для MediaPipe Pose - используем стандартные
try:
    # Пытаемся использовать стандартные соединения MediaPipe
    from mediapipe.python.solutions.pose import POSE_CONNECTIONS as MP_POSE_CONNECTIONS
    POSE_CONNECTIONS = list(MP_POSE_CONNECTIONS)
    logger.info(f"Using standard MediaPipe POSE_CONNECTIONS: {len(POSE_CONNECTIONS)} connections")
except ImportError:
    # Если не удается импортировать, используем наши
    POSE_CONNECTIONS = [
        # Лицо
        (0, 1), (1, 2), (2, 3), (3, 7),
        (0, 4), (4, 5), (5, 6), (6, 8),
        # Торс  
        (9, 10),
        (11, 12), (11, 23), (12, 24), (23, 24),
        # Руки
        (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
        (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
        # Ноги
        (23, 25), (25, 27), (27, 29), (29, 31), (27, 31),
        (24, 26), (26, 28), (28, 30), (30, 32), (28, 32)
    ]
    logger.info(f"Using custom POSE_CONNECTIONS: {len(POSE_CONNECTIONS)} connections")

# Мониторинг памяти
def check_memory_usage():
    """Проверяет текущее использование памяти и возвращает True, если продолжение обработки безопасно"""
    memory_percent = psutil.virtual_memory().percent
    performance_stats["memory_usage"].append(memory_percent)
    return memory_percent < MAX_MEMORY_PERCENT

# ----------------------------------------------------------------------------
# 📦 Загрузка модели (одноразовая)
# ----------------------------------------------------------------------------
VARIANT_URL = {
    "lite":  "pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full":  "pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}
BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
MODEL_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODEL_DIR / f"pose_landmarker_{POSE_MODEL}.task"
if not MODEL_PATH.exists():
    logger.info("Загрузка модели %s…", POSE_MODEL)
    urllib.request.urlretrieve(BASE_URL + VARIANT_URL[POSE_MODEL], MODEL_PATH)
    logger.info("Сохранено в %s", MODEL_PATH)

# ----------------------------------------------------------------------------
# 🚀 Инициализация определителя ключевых точек
# ----------------------------------------------------------------------------
_delegate = mp.tasks.BaseOptions.Delegate.GPU if POSE_DELEGATE == "gpu" else mp.tasks.BaseOptions.Delegate.CPU

# Создаем локальный для потока определитель для обеспечения параллельной обработки
thread_local = threading.local()

def _preprocess_image(frame_rgb: np.ndarray) -> np.ndarray:
    """Предварительная обработка изображения для улучшения детекции"""
    try:
        # Проверяем размер изображения
        if frame_rgb.size == 0:
            logger.error("Empty image received in preprocessing")
            return frame_rgb
            
        # Минимальная обработка для сохранения качества
        frame_rgb = cv2.convertScaleAbs(frame_rgb, alpha=1.0, beta=0)
        return frame_rgb
        
    except Exception as e:
        logger.error(f"Error in image preprocessing: {e}")
        return frame_rgb

def get_landmarker():
    """Получение или создание экземпляра определителя, локального для потока"""
    if not hasattr(thread_local, "landmarker"):
        try:
            # Используем новый API MediaPipe Tasks для множественных поз
            base_options = python.BaseOptions(
                model_asset_path=str(MODEL_PATH),
                delegate=_delegate
            )
            options = python.vision.PoseLandmarkerOptions(
                base_options=base_options,
                running_mode=python.vision.RunningMode.IMAGE,
                num_poses=50,  # Увеличиваем до 50 для обнаружения большего количества людей
                min_pose_detection_confidence=0.05,  # Снижаем порог для лучшего обнаружения
                min_pose_presence_confidence=0.05,   # Снижаем порог присутствия
                min_tracking_confidence=0.05,        # Снижаем порог отслеживания
                output_segmentation_masks=False
            )
            thread_local.landmarker = python.vision.PoseLandmarker.create_from_options(options)
            logger.info(f"Created PoseLandmarker with max {options.num_poses} poses, detection confidence {options.min_pose_detection_confidence}")
        except Exception as e:
            logger.error(f"Failed to create PoseLandmarker: {e}")
            raise
    return thread_local.landmarker

# Инициализируем первый определитель
landmarker = get_landmarker()
logger.info("Определитель ключевых точек готов (модель=%s, делегат=%s)", POSE_MODEL, POSE_DELEGATE)

_timestamp_ms = itertools.count(0, 33)  # ~30 fps метки времени

# Периодически очищаем старые записи в кэше и данные по ограничению частоты запросов
def _cleanup_task():
    while True:
        try:
            # Очищаем ограничитель частоты запросов
            now = time.time()
            if now - rate_limiter["last_cleared"] > 60:  # Очищаем каждую минуту
                rate_limiter["requests"] = {}
                rate_limiter["last_cleared"] = now
                
            # Очищаем кэш кадров, если он стал слишком большим или уровень использования памяти высокий
            memory_percent = psutil.virtual_memory().percent
            performance_stats["memory_usage"].append(memory_percent)
            
            # Более агрессивная очистка, если использование памяти высокое
            target_size = CACHE_SIZE
            if memory_percent > 70:
                target_size = int(CACHE_SIZE * 0.7)  # Уменьшаем до 70% от максимума, если память высокая
            elif memory_percent > 60:
                target_size = int(CACHE_SIZE * 0.8)  # Уменьшаем до 80% от максимума, если память умеренная
                
            while len(frame_cache) > target_size:
                frame_cache.popitem(last=False)
                
            # Периодически очищаем кэш схожести
            if len(similarity_cache) > 1000:  # Ограничиваем размер кэша схожести
                similarity_cache.clear()
                
            time.sleep(30)  # Запускаем очистку каждые 30 секунд
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

# Запускаем поток очистки
cleanup_thread = threading.Thread(target=_cleanup_task, daemon=True)
cleanup_thread.start()

# ----------------------------------------------------------------------------
# 🔍 Вспомогательные функции
# ----------------------------------------------------------------------------
def _compute_frame_hash(frame: np.ndarray, click_point=None) -> str:
    """Вычисляет хеш для кадра и точки клика"""
    # Хеш на основе уменьшенной яркости и точки клика
    small = cv2.resize(frame, (32, 32))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    click_str = f"{click_point}" if click_point else "no_click"
    return hashlib.md5(gray.tobytes() + click_str.encode()).hexdigest()

def _bgr_to_mp_image(frame_bgr: np.ndarray) -> mp.Image:
    """Конвертирует изображение OpenCV BGR в изображение MediaPipe RGB"""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    try:
        # Используем новый API MediaPipe Tasks
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    except (TypeError, AttributeError):
        # Запасной вариант для старых версий MediaPipe
        return frame_rgb

# Вспомогательная функция для отрисовки ключевых точек с использованием соответствующей версии MediaPipe
def draw_landmarks_on_image(image, landmarks, connections, is_selected=False):
    """Отрисовывает ключевые точки и соединения на изображении, используя соответствующую версию MediaPipe"""
    # Выбираем цвета в зависимости от статуса выбора
    has_alpha = len(image.shape) == 3 and image.shape[2] == 4
    color = (0, 255, 255, 255) if is_selected else (0, 255, 0, 255)  # Желтый для выбранного, зеленый для остальных
    
    # Получаем размеры изображения
    h, w = image.shape[:2]
    
    # Сначала конвертируем ключевые точки в стандартизированный формат
    landmark_points = []
    
    # Обрабатываем различные форматы ключевых точек
    if isinstance(landmarks, list):
        # Прямой список ключевых точек (новый API MediaPipe)
        if len(landmarks) > 0 and hasattr(landmarks[0], 'x') and hasattr(landmarks[0], 'y'):
            # Это уже список объектов ключевых точек
            landmark_points = landmarks
        else:
            # Пустой или неожиданный формат
            logger.warning(f"Unexpected landmark format in list: {type(landmarks[0]) if landmarks else 'empty'}")
            return
    elif hasattr(landmarks, 'landmark'):
        # Объект с атрибутом landmark (старый API MediaPipe)
        landmark_points = landmarks.landmark
    else:
        logger.warning(f"Unknown landmark format: {type(landmarks)}")
        return
    
    try:
        # Проверяем, используем ли мы старую или новую версию MediaPipe для отрисовки
        if hasattr(mp_drawing, 'draw_landmarks') and isinstance(landmarks, landmark_pb2.NormalizedLandmarkList):
            # Используем встроенную отрисовку MediaPipe для правильного формата
            mp_drawing.draw_landmarks(
                image, landmarks, connections,
                mp_drawing.DrawingSpec(color=color[:3], thickness=5, circle_radius=5),
                mp_drawing.DrawingSpec(color=color[:3], thickness=4)
            )
            if has_alpha:
                # Устанавливаем альфа-канал для нарисованных элементов
                gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
                image[gray > 0, 3] = 255
        else:
            # Ручная отрисовка для всех остальных случаев
            # Сначала рисуем соединения
            if connections:
                for connection in connections:
                    if len(connection) != 2:
                        continue
                        
                    start_idx, end_idx = connection
                    
                    if start_idx >= len(landmark_points) or end_idx >= len(landmark_points):
                        continue
                    
                    start_point = (
                        int(landmark_points[start_idx].x * w), 
                        int(landmark_points[start_idx].y * h)
                    )
                    end_point = (
                        int(landmark_points[end_idx].x * w),
                        int(landmark_points[end_idx].y * h)
                    )
                    
                    if has_alpha:
                        cv2.line(image, start_point, end_point, color[:3], 4)
                        # Создаем маску для линии и устанавливаем альфа
                        mask = np.zeros((h, w), dtype=np.uint8)
                        cv2.line(mask, start_point, end_point, 255, 4)
                        image[mask > 0, 3] = 255
                    else:
                        cv2.line(image, start_point, end_point, color[:3], 4)
            
            # Затем рисуем ключевые точки
            for landmark in landmark_points:
                if not hasattr(landmark, 'x') or not hasattr(landmark, 'y'):
                    continue
                
                x, y = int(landmark.x * w), int(landmark.y * h)
                if has_alpha:
                    cv2.circle(image, (x, y), 10, color[:3], -1)
                    # Создаем маску для круга и устанавливаем альфа
                    mask = np.zeros((h, w), dtype=np.uint8)
                    cv2.circle(mask, (x, y), 10, 255, -1)
                    image[mask > 0, 3] = 255
                else:
                    cv2.circle(image, (x, y), 10, color[:3], -1)
    except Exception as e:
        logger.error(f"Error drawing landmarks: {e}")
        # Запасной вариант для минимальной отрисовки в случае ошибки
        try:
            cv2.putText(image, "Error drawing landmarks", (int(w/2)-100, int(h/2)), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        except:
            pass

def _landmarks_to_json(lms) -> List[dict[str, float]]:
    """Конвертирует ключевые точки в JSON-сериализуемый формат"""
    # Обрабатываем новый формат MediaPipe Tasks API
    if hasattr(lms, '__iter__'):
        # Это итерируемый объект (NormalizedLandmarkList)
        return [{
            "x": lm.x, 
            "y": lm.y, 
            "z": lm.z, 
            "visibility": getattr(lm, 'visibility', 1.0)
        } for lm in lms]
    elif hasattr(lms, 'landmark'):
        # Старый формат MediaPipe API
        return [{
            "x": lm.x, 
            "y": lm.y, 
            "z": lm.z, 
            "visibility": getattr(lm, 'visibility', 1.0)
        } for lm in lms.landmark]
    else:
        # Запасной вариант, если структура неизвестна
        logger.warning(f"Unknown landmarks format: {type(lms)}")
        return []

def _add_performance_stat(processing_time: int):
    """Записывает время обработки для отслеживания производительности"""
    performance_stats["processing_times"].append(processing_time)
    performance_stats["processed_frames"] += 1

def _get_avg_processing_time() -> float:
    """Получает среднее время обработки за последние N кадров"""
    if not performance_stats["processing_times"]:
        return 0.0
    return sum(performance_stats["processing_times"]) / len(performance_stats["processing_times"])

def _poses_are_similar(pose1, pose2, threshold=0.12):
    """Проверяет, являются ли две позы дубликатами"""
    if not pose1 or not pose2:
        return False
    
    # Сравниваем больше ключевых точек для более надежного определения дубликатов
    key_points = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]  # нос, плечи, локти, запястья, бедра, колени, лодыжки
    total_distance = 0
    valid_points = 0
    
    min_len = min(len(pose1), len(pose2))
    
    for point_idx in key_points:
        if point_idx >= min_len:
            continue
            
        lm1 = pose1[point_idx]
        lm2 = pose2[point_idx]
        
        # Учитываем только достаточно видимые точки
        vis1 = getattr(lm1, 'visibility', 1.0)
        vis2 = getattr(lm2, 'visibility', 1.0)
        
        if vis1 > 0.3 and vis2 > 0.3:  # Повышаем порог видимости для более надежного сравнения
            dx = lm1.x - lm2.x
            dy = lm1.y - lm2.y
            total_distance += math.sqrt(dx*dx + dy*dy)
            valid_points += 1
    
    if valid_points < 3:  # Требуем минимум 3 видимые точки для сравнения
        return False
        
    avg_distance = total_distance / valid_points
    
    # Дополнительная проверка по центру масс
    center1_x = sum(lm.x for lm in pose1) / len(pose1)
    center1_y = sum(lm.y for lm in pose1) / len(pose1)
    center2_x = sum(lm.x for lm in pose2) / len(pose2)
    center2_y = sum(lm.y for lm in pose2) / len(pose2)
    
    center_distance = math.sqrt((center1_x - center2_x)**2 + (center1_y - center2_y)**2)
    
    # Позы считаются дубликатами, если и средняя дистанция ключевых точек, и дистанция центров малы
    return avg_distance < threshold and center_distance < threshold * 1.5

# ----------------------------------------------------------------------------
# 🏃 Обработка
# ----------------------------------------------------------------------------
def _process(frame: np.ndarray, draw: bool, ret_img: bool, overlay: bool, click_point=None) -> dict[str, Any]:
    """Обработка одного кадра для обнаружения поз"""
    t0 = time.time()
    
    # Получаем оригинальные размеры кадра
    original_h, original_w = frame.shape[:2]
    logger.info(f"Processing frame with shape: {frame.shape}, original click_point: {click_point}")
    
    # Масштабируем точку клика, если она предоставлена (из оригинальных в обработанные координаты)
    scaled_click_point = None
    if click_point:
        click_x, click_y = click_point
        # Координаты точки клика уже в координатах оригинального изображения
        scaled_click_point = (click_x, click_y)
        logger.info(f"Using click point: ({click_x}, {click_y})")
    
    # Изменяем размер кадра для обработки (сохраняя пропорции)
    if original_w > 640 or original_h > 360:
        # Вычисляем масштаб, чтобы вписаться в 640x360, сохраняя пропорции
        scale = min(640 / original_w, 360 / original_h)
        new_w = int(original_w * scale)
        new_h = int(original_h * scale)
        frame_rgb = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), (new_w, new_h))
        logger.info(f"Resized frame to: {new_w}x{new_h}")
    else:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        new_w, new_h = original_w, original_h
    
    # Сохраняем размеры для обработки
    h, w = new_h, new_w
    
    # Вычисляем хеш кадра для кэширования
    frame_hash = _compute_frame_hash(frame_rgb, scaled_click_point)
    if frame_hash in frame_cache:
        cached_result = frame_cache[frame_hash].copy()
        performance_stats["cached_hits"] += 1
        logger.info(f"Returning cached result with {len(cached_result.get('poses', []))} poses")
        return cached_result
    
    try:
        # Обработка с помощью определителя поз
        landmarker = get_landmarker()
        all_poses = []
        
        # Используем более агрессивную многомасштабную детекцию для видео
        scales = [1.0, 0.6, 0.8, 1.2, 1.4, 0.5, 1.6]  # Больше масштабов, включая очень маленькие
        
        for scale_idx, scale in enumerate(scales):
            try:
                # Масштабируем изображение
                if scale != 1.0:
                    scaled_h = int(h * scale)
                    scaled_w = int(w * scale)
                    # Убеждаемся, что размеры не слишком маленькие и не слишком большие
                    if scaled_h < 60 or scaled_w < 60 or scaled_h > 1400 or scaled_w > 1400:
                        continue
                    scaled_frame_rgb = cv2.resize(frame_rgb, (scaled_w, scaled_h))
                else:
                    scaled_frame_rgb = frame_rgb
                    scaled_h, scaled_w = h, w
                
                # Предобработка изображения для лучшего обнаружения
                processed_frame = _preprocess_image(scaled_frame_rgb)
                
                # Конвертируем в MediaPipe формат
                mp_image = _bgr_to_mp_image(cv2.cvtColor(processed_frame, cv2.COLOR_RGB2BGR))
                
                # Обнаружение поз
                detection_result = landmarker.detect(mp_image)
                
                if detection_result.pose_landmarks:
                    logger.info(f"Scale {scale}: detected {len(detection_result.pose_landmarks)} poses")
                    
                    # MediaPipe возвращает нормализованные координаты [0,1] относительно входного изображения
                    # Эти координаты уже корректны и не требуют дополнительной коррекции
                    for pose_landmarks in detection_result.pose_landmarks:
                        # Просто добавляем landmarks как есть - они уже нормализованы
                        all_poses.append(list(pose_landmarks))
                
            except Exception as e:
                logger.warning(f"Error processing scale {scale}: {e}")
                continue
        
        logger.info(f"Total detected {len(all_poses)} poses")
        
        # Удаляем дубликаты поз
        unique_poses = []
        for pose in all_poses:
            is_duplicate = False
            for existing_pose in unique_poses:
                if _poses_are_similar(pose, existing_pose, threshold=0.08):  # Более строгий порог
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_poses.append(pose)
        
        pose_landmarks = unique_poses
        logger.info(f"After deduplication: {len(pose_landmarks)} unique poses")
        
    except Exception as e:
        logger.error(f"Error in pose detection: {e}")
        pose_landmarks = []
    
    # Подготавливаем данные о позах
    poses_data = []
    num_poses = len(pose_landmarks) if pose_landmarks else 0
    logger.info(f"Detected {num_poses} poses")
    
    # Если поз не найдено и запрошено изображение, возвращаем прозрачный оверлей
    if not pose_landmarks and ret_img:
        res = {
            "poses": [],
            "frame_width": original_w,
            "frame_height": original_h,
            "num_poses": 0,
            "processing_time_ms": int((time.time() - t0) * 1000),
        }
        if overlay:
            # Создаем полностью прозрачное изображение
            img_out = np.zeros((original_h, original_w, 4), dtype=np.uint8)
            res["image"] = "data:image/png;base64," + _encode_png(img_out)
            logger.info(f"Added transparent PNG overlay with no poses")
        else:
            # Возвращаем оригинальное изображение
            res["image"] = "data:image/jpeg;base64," + _encode_jpeg(frame, JPEG_Q)
        return res
    
    # Обрабатываем обнаруженные позы и находим ближайшую к точке клика, если она предоставлена
    closest_pose_idx = None
    min_distance = float('inf')
    closest_pose_score = 0
    
    for i, pose_landmark in enumerate(pose_landmarks):
        # Конвертируем ключевые точки в более удобный формат
        landmarks_data = []
        
        # Обрабатываем новый формат MediaPipe Tasks API
        # pose_landmark это список ключевых точек
        for lm in pose_landmark:
            landmarks_data.append({
                "x": lm.x, 
                "y": lm.y, 
                "z": lm.z, 
                "visibility": getattr(lm, 'visibility', 1.0)
            })
        
        # Пропускаем, если ключевые точки не обнаружены
        if not landmarks_data:
            logger.warning(f"No landmarks data for pose {i}")
            continue
            
        # Вычисляем ограничивающий прямоугольник в нормализованных координатах [0,1]
        x_coords = [lm["x"] for lm in landmarks_data]
        y_coords = [lm["y"] for lm in landmarks_data]
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)
        
        # Вычисляем центральную точку позы
        center_x = (x_min + x_max) / 2
        center_y = (y_min + y_max) / 2
        
        # Вычисляем среднюю видимость как метрику качества
        visibilities = [lm.get("visibility", 0) for lm in landmarks_data]
        avg_visibility = sum(visibilities) / len(visibilities) if visibilities else 0
        
        # Добавляем данные о позе - конвертируем в координаты оригинального изображения
        pose_info = {
            "landmarks": landmarks_data,
            "bbox": {
                "x_min": x_min * original_w,
                "y_min": y_min * original_h,
                "x_max": x_max * original_w,
                "y_max": y_max * original_h,
                "width": (x_max - x_min) * original_w,
                "height": (y_max - y_min) * original_h,
                "center_x": center_x * original_w,
                "center_y": center_y * original_h,
            },
            "visibility_score": avg_visibility
        }
        
        poses_data.append(pose_info)
            
        # Если точка клика предоставлена, вычисляем расстояние до этой позы
        if scaled_click_point:
            click_x, click_y = scaled_click_point
            
            # Проверяем, находится ли точка клика внутри bbox в пиксельных координатах
            bbox_x_min = x_min * original_w
            bbox_x_max = x_max * original_w
            bbox_y_min = y_min * original_h
            bbox_y_max = y_max * original_h
            
            is_inside_bbox = (
                bbox_x_min <= click_x <= bbox_x_max and 
                bbox_y_min <= click_y <= bbox_y_max
            )
            
            logger.info(f"Pose {i} bbox: ({bbox_x_min:.1f}, {bbox_y_min:.1f}) to ({bbox_x_max:.1f}, {bbox_y_max:.1f})")
            logger.info(f"Checking click ({click_x}, {click_y}) against pose {i}: inside_bbox={is_inside_bbox}")
            
            # Рассчитываем расстояния в пиксельных координатах
            center_x_px = center_x * original_w
            center_y_px = center_y * original_h
            dist_to_center = math.sqrt(
                (center_x_px - click_x) ** 2 + 
                (center_y_px - click_y) ** 2
            )
            
            # Находим ближайшую видимую ключевую точку
            min_keypoint_dist = float('inf')
            for lm in landmarks_data:
                if lm["visibility"] > 0.5:  # Учитываем только достаточно видимые точки
                    lm_x_px = lm["x"] * original_w
                    lm_y_px = lm["y"] * original_h
                    lm_dist = math.sqrt(
                        (lm_x_px - click_x) ** 2 + 
                        (lm_y_px - click_y) ** 2
                    )
                    min_keypoint_dist = min(min_keypoint_dist, lm_dist)
            
            # Рассчитываем финальную оценку
            pose_size = math.sqrt((bbox_x_max - bbox_x_min) ** 2 + (bbox_y_max - bbox_y_min) ** 2)
            pose_score = avg_visibility * (0.7 + pose_size / (original_w * original_h) * 0.3)
            
            if is_inside_bbox:
                # Если клик внутри bbox, этот танцор становится приоритетным
                final_score = 0.1  # Очень низкий score для кликов внутри bbox
                logger.info(f"Click is inside bbox of pose {i}")
                
                # Обновляем выбор только если это первый найденный танцор или у него лучше score
                if closest_pose_idx is None or pose_score > closest_pose_score:
                    closest_pose_idx = i
                    min_distance = final_score
                    closest_pose_score = pose_score
                    logger.info(f"Selected pose {i} (inside bbox) with score {pose_score:.3f}")
            else:
                # Для кликов вне bbox используем взвешенную комбинацию расстояний
                final_score = min(dist_to_center, min_keypoint_dist) * (1.0 - pose_score * 0.5)
                
                # Обновляем выбор только если нет танцора с кликом внутри bbox
                if (closest_pose_idx is None or 
                    not poses_data[closest_pose_idx].get("is_click_inside", False)) and final_score < min_distance:
                    closest_pose_idx = i
                    min_distance = final_score
                    closest_pose_score = pose_score
                    logger.info(f"Selected pose {i} (outside bbox) with score {final_score:.3f}")
            
            # Сохраняем информацию о клике для этой позы
            pose_info.update({
                "is_click_inside": is_inside_bbox,
                "distance_to_center": dist_to_center,
                "min_keypoint_distance": min_keypoint_dist,
                "final_score": final_score,
                "pose_score": pose_score,
                "bbox_debug": {
                    "x_min": bbox_x_min,
                    "y_min": bbox_y_min,
                    "x_max": bbox_x_max,
                    "y_max": bbox_y_max,
                    "click": {"x": click_x, "y": click_y}
                }
            })
    
    # Подготавливаем словарь результатов
    res = {
        "poses": poses_data,
        "frame_width": original_w,
        "frame_height": original_h,
        "num_poses": len(poses_data),
        "processing_time_ms": int((time.time() - t0) * 1000),
    }
    
    # Если точка клика была предоставлена, включаем ближайшую позу
    if scaled_click_point and closest_pose_idx is not None:
        res["selected_pose_index"] = closest_pose_idx
        logger.info(f"Final selected pose: {closest_pose_idx}")
    elif scaled_click_point:
        logger.warning("No pose selected for click point")
    
    # Отрисовываем ключевые точки на изображении, если запрошено
    if (draw or overlay) and ret_img:
        logger.info(f"Drawing landmarks with draw={draw}, overlay={overlay}")
        logger.info(f"pose_landmarks length: {len(pose_landmarks) if pose_landmarks else 0}")
        logger.info(f"click_point: {scaled_click_point}, closest_pose_idx: {closest_pose_idx}")
        
        if overlay:
            # Создаем полностью прозрачное базовое изображение с ОРИГИНАЛЬНЫМИ размерами
            img_out = np.zeros((original_h, original_w, 4), dtype=np.uint8)
            logger.info(f"Created transparent image with original shape: {img_out.shape}")
            
            if pose_landmarks and len(pose_landmarks) > 0:
                logger.info("About to draw poses...")
                # Отрисовываем только выбранную позу, если у нас есть точка клика
                if scaled_click_point is not None and closest_pose_idx is not None:
                    # Отрисовываем только выбранную позу
                    logger.info(f"Drawing selected pose {closest_pose_idx}")
                    pose_landmark = pose_landmarks[closest_pose_idx]
                    draw_landmarks_on_image(img_out, pose_landmark, POSE_CONNECTIONS, True)
                else:
                    # Если нет точки клика, отрисовываем все позы
                    logger.info(f"Drawing all {len(pose_landmarks)} poses")
                    for i, pose_landmark in enumerate(pose_landmarks):
                        logger.info(f"Drawing pose {i}")
                        draw_landmarks_on_image(img_out, pose_landmark, POSE_CONNECTIONS, False)
            else:
                logger.warning("No pose landmarks to draw!")
            
            res["image"] = "data:image/png;base64," + _encode_png(img_out)
            logger.info(f"Added transparent PNG overlay with {len(pose_landmarks)} poses")
        else:
            # Отрисовываем на оригинальном изображении
            img_out = frame.copy()  # Используем оригинальный BGR кадр
            if pose_landmarks and len(pose_landmarks) > 0:
                if scaled_click_point is not None and closest_pose_idx is not None:
                    # Отрисовываем только выбранную позу
                    pose_landmark = pose_landmarks[closest_pose_idx]
                    draw_landmarks_on_image(img_out, pose_landmark, POSE_CONNECTIONS, True)
                else:
                    # Если нет точки клика, отрисовываем все позы
                    for i, pose_landmark in enumerate(pose_landmarks):
                        draw_landmarks_on_image(img_out, pose_landmark, POSE_CONNECTIONS, False)
            
            res["image"] = "data:image/jpeg;base64," + _encode_jpeg(img_out, JPEG_Q)
            logger.info(f"Added JPEG image with {len(pose_landmarks)} poses")
    
    # Записываем статистику производительности и кэшируем результат
    _add_performance_stat(res["processing_time_ms"])
    frame_cache[frame_hash] = res
    
    logger.info(f"Returning result with {len(poses_data)} poses, selected_index={res.get('selected_pose_index')}")
    return res

# ----------------------------------------------------------------------------
# 🌐 FastAPI
# ----------------------------------------------------------------------------
app = FastAPI(title="Dancer Detector API")

# Настраиваем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Для разработки - ограничить в продакшене
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-frame")
async def process_frame(
    file: UploadFile = File(...),
    image: int = Query(1, description="Возвращать изображение 0/1"),
    draw: int = Query(1, description="Отрисовывать ключевые точки на изображении 0/1"),
    overlay: int = Query(1, description="Возвращать только скелет PNG с прозрачностью 0/1"),
    resize: int = Query(1, description="Изменять размер больших кадров для лучшей производительности 0/1"),
    click_x: int = Query(None, description="X координата точки клика"),
    click_y: int = Query(None, description="Y координата точки клика"),
    x_forwarded_for: str = Header(None),
):
    """Обработка кадра видео для обнаружения поз"""
    response = Response()
    
    logger.info(f"Received request: click_x={click_x}, click_y={click_y}, image={image}, draw={draw}, overlay={overlay}")
    
    # Простое ограничение частоты запросов по IP
    client_ip = x_forwarded_for or "unknown"
    current_time = time.time()
    
    # Проверяем, не делает ли этот IP слишком много запросов
    if client_ip in rate_limiter["requests"]:
        request_count = rate_limiter["requests"][client_ip]
        if request_count > rate_limiter["max_per_minute"]:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=429,
                content={"error": "Превышен лимит запросов. Пожалуйста, попробуйте позже."}
            )
        rate_limiter["requests"][client_ip] += 1
    else:
        rate_limiter["requests"][client_ip] = 1
    
    try:
        # Читаем кадр из загруженного файла
        contents = await file.read()
        logger.info(f"Read {len(contents)} bytes from uploaded file")
        logger.info(f"Content type: {file.content_type}, filename: {file.filename}")
        
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            logger.error("Failed to decode image data")
            return JSONResponse(
                status_code=400,
                content={"error": "Некорректные данные изображения"}
            )
            
        logger.info(f"Decoded image with shape: {frame.shape}, dtype: {frame.dtype}, range: [{frame.min()}, {frame.max()}]")
        
        # Убеждаемся, что изображение имеет 3 канала (BGR)
        if len(frame.shape) != 3 or frame.shape[2] != 3:
            logger.warning(f"Image has wrong number of channels: {frame.shape}")
            
            # Если изображение имеет 4 канала (BGRA), конвертируем в BGR
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                logger.info("Converting BGRA to BGR")
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            # Если изображение в оттенках серого, конвертируем в BGR
            elif len(frame.shape) == 2 or (len(frame.shape) == 3 and frame.shape[2] == 1):
                logger.info("Converting grayscale to BGR")
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            else:
                logger.error(f"Unsupported image format with shape {frame.shape}")
                return JSONResponse(
                    status_code=400,
                    content={"error": "Неподдерживаемый формат изображения. Должен быть RGB или оттенки серого."}
                )
                
            logger.info(f"After conversion, image shape: {frame.shape}")
        
        # Обрабатываем кадр с точкой клика или без нее
        click_point = None
        if click_x is not None and click_y is not None:
            click_point = (click_x, click_y)
            logger.info(f"Processing frame with click_point: ({click_x}, {click_y})")
            
        result = _process(
            frame=frame,
            draw=bool(draw),
            ret_img=bool(image),
            overlay=bool(overlay),
            click_point=click_point
        )
        
        # Устанавливаем заголовок ETag для кэширования браузера, если включено
        if USE_ETAG:
            result_hash = hashlib.md5(str(result).encode()).hexdigest()
            response.headers["ETag"] = f'W/"{result_hash}"'
            
        logger.info(f"Returning result with {len(result.get('poses', []))} poses")
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"Ошибка обработки: {str(e)}"}
        )

@app.get("/health")
async def health():
    """Проверка состояния сервиса"""
    avg_time = _get_avg_processing_time()
    memory_usage = psutil.virtual_memory().percent
    
    return {
        "status": "ok",
        "memory_usage_percent": memory_usage,
        "avg_processing_time_ms": avg_time,
        "processed_frames": performance_stats["processed_frames"],
        "cached_hits": performance_stats["cached_hits"],
        "model": POSE_MODEL,
        "delegate": POSE_DELEGATE,
    }

@app.get("/clear-cache")
async def clear_cache():
    """Очистка всех кэшей"""
    frame_cache.clear()
    similarity_cache.clear()
    return {"status": "ok", "message": "Кэш успешно очищен"}
