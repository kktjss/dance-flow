"""
Сервер видеоанализа Dance Flow
===============================
Запуск сервера обнаружения танцора
"""

import os
import logging
import uvicorn
from pathlib import Path

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backend.log")
    ]
)

logger = logging.getLogger(__name__)

# Конфигурация сервера - пытаемся импортировать из настроек или использовать значения по умолчанию
try:
    from config.settings import HOST, PORT, LOG_LEVEL, WORKERS
    logger.info("Используем настройки из модуля конфигурации")
except ImportError:
    logger.info("Модуль конфигурации не найден, используем переменные окружения")
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
    WORKERS = int(os.getenv("WORKERS", "1"))

if __name__ == "__main__":
    logger.info(f"Запуск сервера видеоанализа на {HOST}:{PORT}")
    
    # Создаем необходимые директории
    Path(".models").mkdir(exist_ok=True)
    
    # Запускаем приложение FastAPI
    uvicorn.run(
        "video_analyzer.detector:app",
        host=HOST,
        port=PORT,
        log_level=LOG_LEVEL,
        workers=WORKERS,
        reload=True,  # Включаем автоматическую перезагрузку для разработки
    ) 