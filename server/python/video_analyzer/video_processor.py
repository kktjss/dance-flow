"""
Видеопроцессор - Обрезка видео и интеграция с API DeepMotion
==========================================================
* Обрезает видео, чтобы танцор оставался в центре
* Использует API DeepMotion для создания 3D анимаций
"""

import os
import cv2
import json
import time
import logging
import requests
import numpy as np
import base64
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
import tempfile
import urllib.parse
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Настройка логирования
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("video_processor")

# Пытаемся импортировать настройки конфигурации
try:
    from config.settings import (
        DEEPMOTION_CLIENT_ID,
        DEEPMOTION_CLIENT_SECRET,
        DEEPMOTION_API_HOST,
        TEMP_DIR,
        OUTPUT_DIR,
    )
except ImportError:
    # Запасной вариант с переменными окружения
    DEEPMOTION_CLIENT_ID = os.getenv("DEEPMOTION_CLIENT_ID", "")
    DEEPMOTION_CLIENT_SECRET = os.getenv("DEEPMOTION_CLIENT_SECRET", "")
    DEEPMOTION_API_HOST = os.getenv("DEEPMOTION_API_HOST", "https://animate3d.deepmotion.com")
    TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/dance_flow"))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/dance_flow/output"))

# Создаем директории, если они не существуют
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class DeepMotionAPI:
    """Интерфейс к REST API DeepMotion Animate 3D"""
    
    def __init__(self, client_id: str, client_secret: str, api_host: str):
        """Инициализация клиента API DeepMotion
        
        Аргументы:
            client_id: ID клиента DeepMotion
            client_secret: Секретный ключ клиента DeepMotion
            api_host: URL хоста API DeepMotion
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_host = api_host
        self.session_cookie = None
    
    async def authenticate(self) -> bool:
        """Аутентификация в API DeepMotion и получение cookie сессии
        
        Возвращает:
            bool: True, если аутентификация прошла успешно, False в противном случае
        """
        if not self.client_id or not self.client_secret:
            logger.error("Требуются ID клиента и секретный ключ DeepMotion")
            return False
        
        # Кодируем ID клиента и секретный ключ
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        # Выполняем запрос аутентификации
        headers = {
            "Authorization": f"Basic {encoded_credentials}"
        }
        
        try:
            url = f"{self.api_host}/session/auth"
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                # Получаем cookie сессии из ответа
                cookies = response.cookies
                if 'dmsess' in cookies:
                    self.session_cookie = cookies['dmsess']
                    logger.info("Успешная аутентификация в API DeepMotion")
                    return True
                else:
                    logger.error("Cookie сессии не найден в ответе аутентификации")
            else:
                logger.error(f"Ошибка аутентификации, код статуса {response.status_code}: {response.text}")
            
            return False
        
        except Exception as e:
            logger.error(f"Ошибка при аутентификации: {str(e)}")
            return False
    
    async def get_upload_url(self, filename: str) -> Optional[str]:
        """Получение подписанного URL для загрузки файла в DeepMotion
        
        Аргументы:
            filename: Имя загружаемого файла
        
        Возвращает:
            str: Подписанный URL для загрузки, если успешно, None в противном случае
        """
        if not self.session_cookie:
            logger.error("Не аутентифицирован. Сначала вызовите authenticate().")
            return None
        
        try:
            url = f"{self.api_host}/upload?n={urllib.parse.quote(filename)}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data:
                    logger.info(f"Получен URL для загрузки {filename}")
                    return data['url']
                else:
                    logger.error(f"URL для загрузки не найден в ответе: {data}")
            else:
                logger.error(f"Не удалось получить URL для загрузки: {response.status_code} - {response.text}")
            
            return None
        
        except Exception as e:
            logger.error(f"Ошибка при получении URL для загрузки: {str(e)}")
            return None
    
    async def upload_file(self, file_path: Path, upload_url: str) -> bool:
        """Загрузка файла по предоставленному URL
        
        Аргументы:
            file_path: Путь к загружаемому файлу
            upload_url: URL для загрузки файла
        
        Возвращает:
            bool: True, если загрузка прошла успешно, False в противном случае
        """
        try:
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Загружаем файл с помощью PUT-запроса
            response = requests.put(
                upload_url,
                data=file_data,
                headers={'Content-Type': 'application/octet-stream'}
            )
            
            if response.status_code == 200:
                logger.info(f"Успешно загружен файл по адресу {upload_url}")
                return True
            else:
                logger.error(f"Не удалось загрузить файл: {response.status_code} - {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"Ошибка при загрузке файла: {str(e)}")
            return False
    
    async def start_processing(self, upload_url: str, crop_params: Optional[Dict] = None) -> Optional[str]:
        """Запуск обработки видео с помощью DeepMotion
        
        Аргументы:
            upload_url: URL загруженного файла
            crop_params: Необязательные параметры для обрезки видео
        
        Возвращает:
            str: ID запроса, если успешно, None в противном случае
        """
        if not self.session_cookie:
            logger.error("Не аутентифицирован. Сначала вызовите authenticate().")
            return None
        
        try:
            url = f"{self.api_host}/process"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}",
                "Content-Type": "application/json"
            }
            
            # Создаем параметры
            params = [
                "config=configDefault",
                "formats=bvh,fbx,mp4",  # Форматы вывода
                "model=deepmotion_humanoid"  # Модель по умолчанию
            ]
            
            # Добавляем параметры обрезки, если они предоставлены
            if crop_params:
                left = crop_params.get('left', 0)
                top = crop_params.get('top', 0)
                right = crop_params.get('right', 1)
                bottom = crop_params.get('bottom', 1)
                crop_param = f"crop={left},{top},{right},{bottom}"
                params.append(crop_param)
            
            # Создаем тело запроса
            data = {
                "url": upload_url,
                "processor": "video2anim",
                "params": params
            }
            
            response = requests.post(url, headers=headers, json=data)
            
            if response.status_code == 200:
                data = response.json()
                if 'rid' in data:
                    logger.info(f"Успешно запущена обработка с ID запроса: {data['rid']}")
                    return data['rid']
                else:
                    logger.error(f"ID запроса не найден в ответе: {data}")
            else:
                logger.error(f"Не удалось запустить обработку: {response.status_code} - {response.text}")
            
            return None
        
        except Exception as e:
            logger.error(f"Ошибка при запуске обработки: {str(e)}")
            return None
    
    async def poll_status(self, request_id: str) -> Dict[str, Any]:
        """Проверка статуса обработки задачи
        
        Аргументы:
            request_id: ID запроса для проверки
        
        Возвращает:
            Dict: Ответ статуса
        """
        if not self.session_cookie:
            logger.error("Не аутентифицирован. Сначала вызовите authenticate().")
            return {"status": "FAILURE", "details": "Not authenticated"}
        
        try:
            url = f"{self.api_host}/status/{request_id}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'status' in data and data['count'] > 0:
                    status_info = data['status'][0]
                    logger.info(f"Статус задачи для {request_id}: {status_info['status']}")
                    return status_info
                else:
                    logger.error(f"Информация о статусе не найдена в ответе: {data}")
                    return {"status": "FAILURE", "details": "No status information"}
            else:
                logger.error(f"Не удалось получить статус: {response.status_code} - {response.text}")
                return {"status": "FAILURE", "details": f"HTTP error: {response.status_code}"}
        
        except Exception as e:
            logger.error(f"Ошибка при получении статуса: {str(e)}")
            return {"status": "FAILURE", "details": str(e)}
    
    async def wait_for_completion(self, request_id: str, max_attempts: int = 60, delay: int = 5) -> Dict[str, Any]:
        """Ожидание завершения задачи путем периодического получения ее статуса
        
        Аргументы:
            request_id: ID запроса для проверки
            max_attempts: Максимальное количество попыток проверки
            delay: Задержка в секундах между попытками проверки
        
        Возвращает:
            Dict: Конечный ответ статуса
        """
        attempts = 0
        while attempts < max_attempts:
            status_info = await self.poll_status(request_id)
            
            if status_info['status'] == 'SUCCESS':
                return status_info
            elif status_info['status'] == 'FAILURE':
                return status_info
            
            # Для задач в процессе, логируем прогресс
            if status_info['status'] == 'PROGRESS' and 'details' in status_info:
                details = status_info['details']
                if 'step' in details and 'total' in details:
                    progress = (details['step'] / details['total']) * 100
                    logger.info(f"Прогресс задачи {request_id}: {progress:.1f}% ({details['step']}/{details['total']})")
            
            # Ждем перед следующей попыткой
            await asyncio.sleep(delay)
            attempts += 1
        
        return {"status": "FAILURE", "details": "Timeout waiting for job completion"}
    
    async def get_download_urls(self, request_id: str) -> Dict[str, Any]:
        """Получение URL для скачивания обработанных файлов
        
        Аргументы:
            request_id: ID запроса
        
        Возвращает:
            Dict: Ответ URL для скачивания
        """
        if not self.session_cookie:
            logger.error("Не аутентифицирован. Сначала вызовите authenticate().")
            return {"status": "FAILURE", "details": "Not authenticated"}
        
        try:
            url = f"{self.api_host}/download/{request_id}"
            headers = {
                "Cookie": f"dmsess={self.session_cookie}"
            }
            
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'links' in data and data['count'] > 0:
                    logger.info(f"Получены URL для скачивания {request_id}")
                    return data['links'][0]
                else:
                    logger.error(f"URL для скачивания не найдены в ответе: {data}")
                    return {"status": "FAILURE", "details": "No download links"}
            else:
                logger.error(f"Не удалось получить URL для скачивания: {response.status_code} - {response.text}")
                return {"status": "FAILURE", "details": f"HTTP error: {response.status_code}"}
        
        except Exception as e:
            logger.error(f"Ошибка при получении URL для скачивания: {str(e)}")
            return {"status": "FAILURE", "details": str(e)}
    
    async def download_file(self, url: str, output_path: Path) -> bool:
        """Скачивание файла по URL
        
        Аргументы:
            url: URL для скачивания
            output_path: Путь для сохранения файла
        
        Возвращает:
            bool: True, если скачивание прошло успешно, False в противном случае
        """
        try:
            response = requests.get(url, stream=True)
            
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                logger.info(f"Файл скачан по адресу {output_path}")
                return True
            else:
                logger.error(f"Не удалось скачать файл: {response.status_code} - {response.text}")
                return False
        
        except Exception as e:
            logger.error(f"Ошибка при скачивании файла: {str(e)}")
            return False

class VideoCropper:
    """Утилита для обрезки видео, чтобы танцор оставался в центре"""
    
    @staticmethod
    def compute_dancer_bounding_box(pose_data: Dict[str, Any]) -> Tuple[float, float, float, float]:
        """Вычисление ограничивающего прямоугольника вокруг танцора из данных о позе
        
        Аргументы:
            pose_data: Данные о позе от детектора
        
        Возвращает:
            Tuple[float, float, float, float]: левая, верхняя, правая, нижняя координаты (0-1 нормализованные)
        """
        # Проверяем, есть ли данные о позе
        if not pose_data or 'poses' not in pose_data or not pose_data['poses']:
            logger.warning("Данных о позе нет для вычисления ограничивающего прямоугольника")
            return 0, 0, 1, 1  # По умолчанию полное окно
        
        # Если есть выбранная поза, используем ее, иначе используем первую
        selected_idx = pose_data.get('selected_pose_index', 0)
        if selected_idx is not None and selected_idx < len(pose_data['poses']):
            pose = pose_data['poses'][selected_idx]
        else:
            pose = pose_data['poses'][0]
        
        # Получаем ограничивающий прямоугольник
        bbox = pose.get('bbox', {})
        x_min = bbox.get('x_min', 0)
        y_min = bbox.get('y_min', 0)
        x_max = bbox.get('x_max', 1)
        y_max = bbox.get('y_max', 1)
        
        # Добавляем небольшой отступ (20%)
        width = x_max - x_min
        height = y_max - y_min
        padding_x = width * 0.2
        padding_y = height * 0.2
        
        x_min = max(0, x_min - padding_x)
        y_min = max(0, y_min - padding_y)
        x_max = min(1, x_max + padding_x)
        y_max = min(1, y_max + padding_y)
        
        return x_min, y_min, x_max, y_max
    
    @staticmethod
    async def crop_video(input_path: Path, output_path: Path, bbox: Tuple[float, float, float, float]) -> bool:
        """Обрезка видео на основе ограничивающего прямоугольника
        
        Аргументы:
            input_path: Путь к входному видео
            output_path: Путь для сохранения обрезанного видео
            bbox: Tuple (left, top, right, bottom) of normalized coordinates (0-1)
        
        Возвращает:
            bool: True, если обрезка прошла успешно, False в противном случае
        """
        try:
            # Получаем свойства видео
            cap = cv2.VideoCapture(str(input_path))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
            logger.info(f"Свойства видео: {width}x{height}, {fps} FPS, {total_frames} кадров")
            
            # Преобразуем нормализованные координаты в пиксельные значения
            left, top, right, bottom = bbox
            x = int(left * width)
            y = int(top * height)
            w = int((right - left) * width)
            h = int((bottom - top) * height)
            
            logger.info(f"Обрезка до: x={x}, y={y}, w={w}, h={h}")
            
            # Создаем видеописатель
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(str(output_path), fourcc, fps, (w, h))
            
            if not writer.isOpened():
                logger.error(f"Не удалось открыть видеописатель для {output_path}")
                return False
            
            # Обрабатываем каждый кадр
            frame_count = 0
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Обрезка кадра
                cropped = frame[y:y+h, x:x+w]
                writer.write(cropped)
                
                frame_count += 1
                if frame_count % 100 == 0:
                    logger.info(f"Обработано {frame_count}/{total_frames} кадров")
            
            # Освобождаем ресурсы
            cap.release()
            writer.release()
            
            logger.info(f"Успешно обрезана видео до {output_path}")
            return True
        
        except Exception as e:
            logger.error(f"Ошибка при обрезке видео: {str(e)}")
            return False

async def process_video_with_deepmotion(video_path: Path, pose_data: Dict[str, Any], output_dir: Path = OUTPUT_DIR) -> Dict[str, Any]:
    """Обработка видео с помощью DeepMotion для создания 3D анимации
    
    Аргументы:
        video_path: Путь к входному видео
        pose_data: Данные о позе от детектора
        output_dir: Директория для сохранения выходных файлов
    
    Возвращает:
        Dict: Результаты операции, включая пути к выходным файлам
    """
    result = {
        "success": False,
        "message": "",
        "output_files": {}
    }
    
    # Создаем временную директорию для промежуточных файлов
    temp_dir = Path(tempfile.mkdtemp(dir=TEMP_DIR))
    
    try:
        # Инициализируем клиент API DeepMotion
        deepmotion_api = DeepMotionAPI(
            client_id=DEEPMOTION_CLIENT_ID,
            client_secret=DEEPMOTION_CLIENT_SECRET,
            api_host=DEEPMOTION_API_HOST
        )
        
        # Аутентифицируемся в API DeepMotion
        auth_success = await deepmotion_api.authenticate()
        if not auth_success:
            result["message"] = "Не удалось аутентифицироваться в API DeepMotion"
            return result
        
        # Вычисляем ограничивающий прямоугольник для танцора
        bbox = VideoCropper.compute_dancer_bounding_box(pose_data)
        logger.info(f"Вычислен ограничивающий прямоугольник: {bbox}")
        
        # Обрезаем видео, чтобы сосредоточиться на танцоре
        cropped_video_path = temp_dir / f"{video_path.stem}_cropped{video_path.suffix}"
        crop_success = await VideoCropper.crop_video(video_path, cropped_video_path, bbox)
        
        if not crop_success:
            result["message"] = "Не удалось обрезать видео"
            return result
        
        # Получаем URL для загрузки обрезанного видео
        upload_url = await deepmotion_api.get_upload_url(cropped_video_path.name)
        if not upload_url:
            result["message"] = "Не удалось получить URL для загрузки"
            return result
        
        # Загружаем обрезанное видео
        upload_success = await deepmotion_api.upload_file(cropped_video_path, upload_url)
        if not upload_success:
            result["message"] = "Не удалось загрузить видео"
            return result
        
        # Запускаем обработку с DeepMotion
        request_id = await deepmotion_api.start_processing(upload_url, {
            "left": bbox[0],
            "top": bbox[1],
            "right": bbox[2],
            "bottom": bbox[3]
        })
        
        if not request_id:
            result["message"] = "Не удалось запустить обработку"
            return result
        
        # Ожидаем завершения задачи
        status_info = await deepmotion_api.wait_for_completion(request_id)
        
        if status_info["status"] != "SUCCESS":
            result["message"] = f"Обработка не удалась: {status_info.get('details', 'Unknown error')}"
            return result
        
        # Получаем URL для скачивания обработанных файлов
        links_info = await deepmotion_api.get_download_urls(request_id)
        
        if "urls" not in links_info:
            result["message"] = "Недоступны URL для скачивания"
            return result
        
        # Скачиваем выходные файлы
        output_files = {}
        for url_group in links_info.get("urls", []):
            for file_entry in url_group.get("files", []):
                for file_type, url in file_entry.items():
                    output_file_path = output_dir / f"{video_path.stem}_{request_id}.{file_type}"
                    download_success = await deepmotion_api.download_file(url, output_file_path)
                    
                    if download_success:
                        output_files[file_type] = str(output_file_path)
                    else:
                        logger.warning(f"Не удалось скачать {file_type} файл")
        
        result["success"] = True
        result["message"] = "Успешно обработано видео"
        result["output_files"] = output_files
        result["request_id"] = request_id
        
        return result
    
    except Exception as e:
        logger.error(f"Ошибка при обработке видео: {str(e)}")
        result["message"] = f"Ошибка: {str(e)}"
        return result
    
    finally:
        # Очищаем временные файлы
        try:
            import shutil
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Не удалось очистить временную директорию: {str(e)}")

# Главная функция обработчика для вызова из внешних модулей
async def create_3d_animation_from_video(video_path: str, pose_data: Dict[str, Any]) -> Dict[str, Any]:
    """Создание 3D анимации из видео с помощью DeepMotion
    
    Аргументы:
        video_path: Путь к входному видео
        pose_data: Данные о позе от детектора
    
    Возвращает:
        Dict: Результаты операции
    """
    video_path = Path(video_path)
    if not video_path.exists():
        return {
            "success": False,
            "message": f"Видеофайл не найден: {video_path}"
        }
    
    return await process_video_with_deepmotion(video_path, pose_data)

# Комментированная версия основной части кода для запроса пользователя:
"""
# Реализация обрезки видео и интеграции с API DeepMotion

import os
import cv2
import json
import time
import logging
import requests
import numpy as np
import base64
from pathlib import Path
from typing import Dict, Any, Tuple, List, Optional
import tempfile
import urllib.parse
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Настройка логирования
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("video_processor")

# Пытаемся импортировать настройки конфигурации
try:
    from config.settings import (
        DEEPMOTION_CLIENT_ID,
        DEEPMOTION_CLIENT_SECRET,
        DEEPMOTION_API_HOST,
        TEMP_DIR,
        OUTPUT_DIR,
    )
except ImportError:
    # Запасной вариант с переменными окружения
    DEEPMOTION_CLIENT_ID = os.getenv("DEEPMOTION_CLIENT_ID", "")
    DEEPMOTION_CLIENT_SECRET = os.getenv("DEEPMOTION_CLIENT_SECRET", "")
    DEEPMOTION_API_HOST = os.getenv("DEEPMOTION_API_HOST", "https://animate3d.deepmotion.com")
    TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/dance_flow"))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "/tmp/dance_flow/output"))

# Создаем директории, если они не существуют
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class DeepMotionAPI:
    # DeepMotion API implementation
    
    def __init__(self, client_id: str, client_secret: str, api_host: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.api_host = api_host
        self.session_cookie = None
    
    async def authenticate(self) -> bool:
        # Authentication logic
        pass
    
    async def get_upload_url(self, filename: str) -> Optional[str]:
        # Get upload URL logic
        pass
    
    async def upload_file(self, file_path: Path, upload_url: str) -> bool:
        # Upload file logic
        pass
    
    async def start_processing(self, upload_url: str, crop_params: Optional[Dict] = None) -> Optional[str]:
        # Start processing logic
        pass
    
    async def poll_status(self, request_id: str) -> Dict[str, Any]:
        # Poll status logic
        pass
    
    async def wait_for_completion(self, request_id: str, max_attempts: int = 60, delay: int = 5) -> Dict[str, Any]:
        # Wait for completion logic
        pass
    
    async def get_download_urls(self, request_id: str) -> Dict[str, Any]:
        # Get download URLs logic
        pass
    
    async def download_file(self, url: str, output_path: Path) -> bool:
        # Download file logic
        pass

class VideoCropper:
    # Video cropping utilities
    
    @staticmethod
    def compute_dancer_bounding_box(pose_data: Dict[str, Any]) -> Tuple[float, float, float, float]:
        # Compute bounding box logic
        pass
    
    @staticmethod
    async def crop_video(input_path: Path, output_path: Path, bbox: Tuple[float, float, float, float]) -> bool:
        # Crop video logic
        pass

async def process_video_with_deepmotion(video_path: Path, pose_data: Dict[str, Any], output_dir: Path = OUTPUT_DIR) -> Dict[str, Any]:
    # Process video with DeepMotion logic
    pass

async def create_3d_animation_from_video(video_path: str, pose_data: Dict[str, Any]) -> Dict[str, Any]:
    # Main handler function
    pass
""" 