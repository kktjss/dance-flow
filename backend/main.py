"""
FastAPI + MediaPipe Tasks — Pose API **v3.1**
===========================================
* VIDEO‑mode landmarker  → ×2‑3 ускорение
* TurboJPEG (если есть)  → ×10 быстрее кодирования JPEG
* Параметр `overlay=1`    → отдаём **только скелет** на прозрачном PNG, чтобы класть поверх `<video>` без копирования пикселей
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

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Query, Response, Header
from fastapi.middleware.cors import CORSMiddleware

# ───────────────────────── Optional TurboJPEG ─────────────────────────
try:
    from turbojpeg import TurboJPEG, TJFLAG_FASTDCT

    _tj = TurboJPEG()

    def _encode_jpeg(img_bgr: np.ndarray, q: int) -> str:
        """Fast JPEG base64 via libjpeg‑turbo."""
        return base64.b64encode(_tj.encode(img_bgr, quality=q, flags=TJFLAG_FASTDCT)).decode()

except ImportError:

    def _encode_jpeg(img_bgr: np.ndarray, q: int) -> str:
        ok, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), q])
        if not ok:
            raise RuntimeError("cv2.imencode failed")
        return base64.b64encode(buf).decode()


def _encode_png(img_bgra: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img_bgra, [cv2.IMWRITE_PNG_COMPRESSION, 3])  # Optimize PNG compression
    if not ok:
        raise RuntimeError("cv2.imencode(.png) failed")
    return base64.b64encode(buf).decode()

# ───────────────────────── MediaPipe ──────────────────────────
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.framework.formats import landmark_pb2

mp_drawing = mp.solutions.drawing_utils
mp_pose = mp.solutions.pose

# ----------------------------------------------------------------------------
# ⚙️  Env / tuning
# ----------------------------------------------------------------------------
POSE_MODEL = os.getenv("POSE_MODEL", "lite")
POSE_DELEGATE = os.getenv("POSE_DELEGATE", "gpu").lower()  # gpu | cpu
TARGET_SIDE = int(os.getenv("TARGET_SIDE", "160"))
MAX_RESIZE_SIDE = int(os.getenv("MAX_RESIZE_SIDE", "640"))  # Max side for resizing input frames
JPEG_Q = int(os.getenv("JPEG_Q", "70"))
PNG_COMPRESSION = int(os.getenv("PNG_COMPRESSION", "3"))  # 0-9, higher is more compression but slower
MODEL_DIR = Path(os.getenv("MODEL_DIR", ".models"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
NUM_WORKERS = int(os.getenv("NUM_WORKERS", "2"))  # Number of worker threads for processing
CACHE_SIZE = int(os.getenv("CACHE_SIZE", "100"))  # Max number of cache entries
MIN_FRAME_DIFF = float(os.getenv("MIN_FRAME_DIFF", "0.05"))  # Minimum difference to consider frames different
USE_ETAG = os.getenv("USE_ETAG", "1") == "1"  # Use ETag for browser caching

# ----------------------------------------------------------------------------
# Processing Pool and Queue
# ----------------------------------------------------------------------------
frame_queue = queue.Queue(maxsize=30)  # Queue for frames to process
result_cache = {}  # Cache for results
frame_cache = OrderedDict()  # LRU cache for frame hashes and results
performance_stats = {
    "processed_frames": 0,
    "cached_hits": 0,
    "processing_times": deque(maxlen=50),  # Track the last 50 processing times
}
pool = ThreadPoolExecutor(max_workers=NUM_WORKERS)

# Rate limiter to prevent overloading
rate_limiter = {
    "last_cleared": time.time(),
    "requests": {},  # IP -> count
    "max_per_minute": 300,  # Max requests per minute per IP
}

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pose_api")

# ----------------------------------------------------------------------------
# 📦 Model download (one‑time)
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
    logger.info("Downloading %s model…", POSE_MODEL)
    urllib.request.urlretrieve(BASE_URL + VARIANT_URL[POSE_MODEL], MODEL_PATH)
    logger.info("Saved to %s", MODEL_PATH)

# ----------------------------------------------------------------------------
# 🚀 Landmarker init
# ----------------------------------------------------------------------------
_delegate = mp_python.BaseOptions.Delegate.GPU if POSE_DELEGATE == "gpu" else mp_python.BaseOptions.Delegate.CPU

# Create a threadlocal landmarker to allow concurrent processing
thread_local = threading.local()

def get_landmarker():
    """Get or create a thread-local landmarker instance"""
    if not hasattr(thread_local, "landmarker"):
        thread_local.landmarker = mp_vision.PoseLandmarker.create_from_options(
            mp_vision.PoseLandmarkerOptions(
                base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=_delegate),
                running_mode=mp_vision.RunningMode.VIDEO,
                num_poses=1,
                output_segmentation_masks=False,
            )
        )
    return thread_local.landmarker

# Initialize first landmarker
landmarker = get_landmarker()
logger.info("Landmarker ready (model=%s, delegate=%s, VIDEO mode)", POSE_MODEL, POSE_DELEGATE)

_timestamp_ms = itertools.count(0, 33)  # ~30 fps timestamps

# Clean up old cache entries and rate limiting data periodically
def _cleanup_task():
    while True:
        try:
            # Clean rate limiter
            now = time.time()
            if now - rate_limiter["last_cleared"] > 60:  # Clean every minute
                rate_limiter["requests"] = {}
                rate_limiter["last_cleared"] = now
                
            # Clean frame cache if too large
            while len(frame_cache) > CACHE_SIZE:
                frame_cache.popitem(last=False)
                
            time.sleep(30)  # Run cleanup every 30 seconds
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

# Start cleanup thread
cleanup_thread = threading.Thread(target=_cleanup_task, daemon=True)
cleanup_thread.start()

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _compute_frame_hash(frame: np.ndarray) -> str:
    """Compute a perceptual hash of a frame for similarity detection"""
    # Downscale to 16x16 grayscale for fast comparison
    small = cv2.resize(frame, (16, 16), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    # Create a hash from the pixel values
    return hashlib.md5(gray.tobytes()).hexdigest()


def _frames_are_similar(frame1_hash: str, frame2_hash: str) -> bool:
    """Check if two frames are perceptually similar"""
    if frame1_hash in frame_cache and frame2_hash in frame_cache:
        # If both frames are in the cache, compare their hashes
        return frame1_hash == frame2_hash
    return False


def _bgr_to_mp_image(frame_bgr: np.ndarray) -> mp.Image:
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    
    # Resize large frames for better performance
    if max(h, w) > MAX_RESIZE_SIDE:
        scale = MAX_RESIZE_SIDE / max(h, w)
        new_h, new_w = int(h * scale), int(w * scale)
        rgb = cv2.resize(rgb, (new_w, new_h), interpolation=cv2.INTER_AREA)
        logger.debug(f"Resized frame from {h}x{w} to {new_h}x{new_w}")
    
    # Additional resize for CPU delegate if needed
    elif _delegate == mp_python.BaseOptions.Delegate.CPU and max(rgb.shape[:2]) > TARGET_SIDE:
        scale = TARGET_SIDE / max(h, w)
        rgb = cv2.resize(rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)


def _landmarks_to_json(lms) -> List[dict[str, float]]:
    return [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} for lm in lms]


def _add_performance_stat(processing_time: int):
    """Add processing time to stats and update metrics"""
    performance_stats["processed_frames"] += 1
    performance_stats["processing_times"].append(processing_time)


def _get_avg_processing_time() -> float:
    """Get average processing time in ms"""
    if not performance_stats["processing_times"]:
        return 0
    return sum(performance_stats["processing_times"]) / len(performance_stats["processing_times"])


def _process_frame_worker():
    """Worker thread function to process frames from the queue"""
    while True:
        try:
            task_id, frame, draw, ret_img, overlay = frame_queue.get()
            try:
                # Check cache first
                frame_hash = _compute_frame_hash(frame)
                if frame_hash in frame_cache:
                    result = frame_cache[frame_hash]
                    performance_stats["cached_hits"] += 1
                    result_cache[task_id] = result
                    logger.debug(f"Cache hit for frame {task_id}")
                else:
                    # Process the frame
                    result = _process(frame, draw, ret_img, overlay)
                    # Cache the result
                    frame_cache[frame_hash] = result
                    result_cache[task_id] = result
            except Exception as e:
                logger.error(f"Error processing frame: {e}")
                result_cache[task_id] = {"success": False, "message": f"Processing error: {str(e)}"}
            finally:
                frame_queue.task_done()
        except Exception as e:
            logger.error(f"Worker thread error: {e}")

# Start worker threads
for _ in range(NUM_WORKERS):
    thread = threading.Thread(target=_process_frame_worker, daemon=True)
    thread.start()

# ----------------------------------------------------------------------------
# Core processing
# ----------------------------------------------------------------------------

def _process(frame: np.ndarray, draw: bool, ret_img: bool, overlay: bool) -> dict[str, Any]:
    ts = next(_timestamp_ms)
    start = time.perf_counter()
    
    # Get frame dimensions
    h, w = frame.shape[:2]
    
    # Process the frame with MediaPipe
    thread_landmarker = get_landmarker()  # Get thread-local landmarker
    res = thread_landmarker.detect_for_video(_bgr_to_mp_image(frame), ts)
    
    elapsed = int((time.perf_counter() - start) * 1000)
    _add_performance_stat(elapsed)

    if not res.pose_landmarks:
        return {"success": False, "processing_ms": elapsed, "message": "No pose"}

    payload: dict[str, Any] = {
        "success": True,
        "processing_ms": elapsed,
        "landmarks": _landmarks_to_json(res.pose_landmarks[0]),
    }

    if ret_img:
        if overlay:
            # Create separate BGR canvas for drawing
            bgr_canvas = np.zeros((h, w, 3), dtype=np.uint8)  # BGR only
            alpha_channel = np.zeros((h, w, 1), dtype=np.uint8)  # Alpha channel
            
            proto = landmark_pb2.NormalizedLandmarkList()
            proto.landmark.extend(
                landmark_pb2.NormalizedLandmark(x=lm.x, y=lm.y, z=lm.z, visibility=lm.visibility)
                for lm in res.pose_landmarks[0]
            )
            mp_drawing.draw_landmarks(
                bgr_canvas,  # Draw on BGR canvas
                proto,
                mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
            )
            
            # Create alpha channel where there is content
            alpha_channel = np.where(bgr_canvas.any(axis=2), 255, 0).astype(np.uint8).reshape(h, w, 1)
            
            # Combine BGR and alpha into BGRA
            canvas = np.concatenate([bgr_canvas, alpha_channel], axis=2)
            
            payload["image"] = _encode_png(canvas)
            payload["format"] = "png"
        else:
            annotated = frame.copy() if draw else frame
            if draw:
                proto = landmark_pb2.NormalizedLandmarkList()
                proto.landmark.extend(
                    landmark_pb2.NormalizedLandmark(x=lm.x, y=lm.y, z=lm.z, visibility=lm.visibility)
                    for lm in res.pose_landmarks[0]
                )
                mp_drawing.draw_landmarks(
                    annotated,
                    proto,
                    mp_pose.POSE_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
                )
            payload["image"] = _encode_jpeg(annotated, JPEG_Q)
            payload["format"] = "jpeg"
    return payload

# ----------------------------------------------------------------------------
# FastAPI setup
# ----------------------------------------------------------------------------
app = FastAPI(title="Pose API v3.1")

origins_env = os.getenv("ALLOWED_ORIGINS")
if origins_env:
    ALLOWED_ORIGINS = [o.strip() for o in origins_env.split(",") if o.strip()]
    ALLOW_CREDENTIALS = True
else:
    ALLOWED_ORIGINS = ["*"]
    ALLOW_CREDENTIALS = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600,
)


@app.post("/process-frame")
async def process_frame(
    file: UploadFile = File(...),
    image: int = Query(1, description="Return image 0/1"),
    draw: int = Query(1, description="Draw landmarks on image 0/1"),
    overlay: int = Query(1, description="Return skeleton-only PNG with alpha 0/1"),
    resize: int = Query(1, description="Resize large frames for better performance 0/1"),
    response: Response = None,
    x_forwarded_for: str = Header(None),
):
    # Simple rate limiting by IP
    client_ip = x_forwarded_for or "unknown"
    now = time.time()
    
    # Reset counters if needed
    if now - rate_limiter["last_cleared"] > 60:
        rate_limiter["requests"] = {}
        rate_limiter["last_cleared"] = now
    
    # Check rate limit
    if client_ip in rate_limiter["requests"]:
        if rate_limiter["requests"][client_ip] > rate_limiter["max_per_minute"]:
            return {"success": False, "message": "Rate limit exceeded"}
        rate_limiter["requests"][client_ip] += 1
    else:
        rate_limiter["requests"][client_ip] = 1
    
    # Read and decode the frame
    raw = await file.read()
    frame_hash = hashlib.md5(raw).hexdigest()
    
    # Check if we have a cached result for this exact frame
    if USE_ETAG and frame_hash in frame_cache:
        if response:
            response.headers["ETag"] = frame_hash
            response.headers["Cache-Control"] = "max-age=3600"
        performance_stats["cached_hits"] += 1
        return frame_cache[frame_hash]
    
    # Set ETag for future caching
    if response and USE_ETAG:
        response.headers["ETag"] = frame_hash
        response.headers["Cache-Control"] = "max-age=3600"
    
    # Decode the image
    frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return {"success": False, "message": "Bad image"}
    
    # Check for similar frames in cache using perceptual hashing
    perceptual_hash = _compute_frame_hash(frame)
    for cached_hash in list(frame_cache.keys())[-10:]:  # Check only the most recent frames
        if _frames_are_similar(perceptual_hash, cached_hash):
            logger.debug(f"Similar frame found in cache {perceptual_hash[:6]} ~ {cached_hash[:6]}")
            performance_stats["cached_hits"] += 1
            return frame_cache[cached_hash]
    
    # Process the frame
    if not resize:
        # Process directly if requested
        result = await asyncio.to_thread(_process, frame, bool(draw), bool(image), bool(overlay))
        frame_cache[frame_hash] = result  # Cache by exact content hash
        return result
        
    # For high-priority or small processing jobs, process directly
    elif frame.shape[0] * frame.shape[1] < 640 * 480:  # If smaller than 640x480, process directly
        result = await asyncio.to_thread(_process, frame, bool(draw), bool(image), bool(overlay))
        frame_cache[frame_hash] = result  # Cache by exact content hash
        return result
    
    # For larger frames, use worker pool
    else:
        task_id = id(frame)  # Simple unique ID
        
        # Put the task in the queue
        try:
            frame_queue.put((task_id, frame, bool(draw), bool(image), bool(overlay)), block=False)
        except queue.Full:
            logger.warning("Queue full, processing in main thread")
            result = await asyncio.to_thread(_process, frame, bool(draw), bool(image), bool(overlay))
            frame_cache[frame_hash] = result  # Cache by exact content hash
            return result
            
        # Wait for result with timeout
        for _ in range(50):  # Wait up to 5 seconds (50 * 0.1)
            if task_id in result_cache:
                result = result_cache[task_id]
                del result_cache[task_id]  # Clean up
                frame_cache[frame_hash] = result  # Cache by exact content hash
                return result
            await asyncio.sleep(0.1)
            
        # If timeout, process in main thread
        logger.warning("Worker timeout, processing in main thread")
        result = await asyncio.to_thread(_process, frame, bool(draw), bool(image), bool(overlay))
        frame_cache[frame_hash] = result  # Cache by exact content hash
        return result


@app.get("/health")
async def health():
    avg_time = _get_avg_processing_time()
    return {
        "status": "ok", 
        "workers": NUM_WORKERS, 
        "queue_size": frame_queue.qsize(),
        "cache_size": len(frame_cache),
        "cache_hits": performance_stats["cached_hits"],
        "processed_frames": performance_stats["processed_frames"],
        "avg_processing_time_ms": avg_time,
    }


@app.get("/clear-cache")
async def clear_cache():
    """Admin endpoint to clear the frame cache"""
    size_before = len(frame_cache)
    frame_cache.clear()
    return {"success": True, "cleared_entries": size_before}
