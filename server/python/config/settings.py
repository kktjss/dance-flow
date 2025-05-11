"""
Video Analyzer Configuration
===========================
Configuration settings for the dancer detection backend
"""

import os
from pathlib import Path

# Server settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
WORKERS = int(os.getenv("WORKERS", "1"))

# Pose detection settings
POSE_MODEL = os.getenv("POSE_MODEL", "lite")  # lite, full, or heavy
POSE_DELEGATE = os.getenv("POSE_DELEGATE", "gpu").lower()  # gpu or cpu
DETECTION_THRESHOLD = float(os.getenv("DETECTION_THRESHOLD", "0.5"))
MAX_RESIZE_SIDE = int(os.getenv("MAX_RESIZE_SIDE", "640"))

# Cache settings
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "200"))
MIN_FRAME_DIFF = float(os.getenv("MIN_FRAME_DIFF", "0.05"))

# File paths
BASE_DIR = Path(__file__).parent.parent
MODEL_DIR = BASE_DIR / ".models"

# Create model directory if it doesn't exist
MODEL_DIR.mkdir(exist_ok=True)

# Variant URLs
VARIANT_URL = {
    "lite":  "pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    "full":  "pose_landmarker_full/float16/1/pose_landmarker_full.task",
    "heavy": "pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}
BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"

# Output image settings
JPEG_Q = int(os.getenv("JPEG_Q", "70"))
PNG_COMPRESSION = int(os.getenv("PNG_COMPRESSION", "3"))

# API settings
ALLOW_CORS = os.getenv("ALLOW_CORS", "1") == "1"
USE_ETAG = os.getenv("USE_ETAG", "1") == "1"
MAX_REQUESTS_PER_MINUTE = int(os.getenv("MAX_REQUESTS_PER_MINUTE", "300")) 