"""
Dance Flow Video Analyzer Server
===============================
Run the dancer detection server
"""

import os
import logging
import uvicorn
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("backend.log")
    ]
)

logger = logging.getLogger(__name__)

# Server configuration - try to import from settings or use defaults
try:
    from config.settings import HOST, PORT, LOG_LEVEL, WORKERS
    logger.info("Using settings from config module")
except ImportError:
    logger.info("No config module found, using environment variables")
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8000"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
    WORKERS = int(os.getenv("WORKERS", "1"))

if __name__ == "__main__":
    logger.info(f"Starting Video Analyzer Server on {HOST}:{PORT}")
    
    # Create necessary directories
    Path(".models").mkdir(exist_ok=True)
    
    # Launch FastAPI application
    uvicorn.run(
        "video_analyzer.detector:app",
        host=HOST,
        port=PORT,
        log_level=LOG_LEVEL,
        workers=WORKERS,
        reload=True,  # Enable auto-reload for development
    ) 