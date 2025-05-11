"""
FastAPI + MediaPipe Tasks — Pose API **v3.1**
===========================================
* Human detection in video pause mode
* Only active in "find dancer" mode
* User clicks on an area, code outlines the person
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
import psutil  # For memory monitoring

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

# Try to import config settings, fall back to environment variables if not available
try:
    from config.settings import (
        POSE_MODEL, POSE_DELEGATE, TARGET_SIDE, MAX_RESIZE_SIDE,
        JPEG_Q, PNG_COMPRESSION, MODEL_DIR, LOG_LEVEL,
        NUM_WORKERS, CACHE_SIZE, MIN_FRAME_DIFF, USE_ETAG,
        MAX_MEMORY_PERCENT, DETECTION_THRESHOLD
    )
except ImportError:
    # Fallback to environment variables
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
# Processing Pool and Queue
# ----------------------------------------------------------------------------
frame_queue = queue.Queue(maxsize=30)  # Queue for frames to process
result_cache = {}  # Cache for results
frame_cache = OrderedDict()  # LRU cache for frame hashes and results
similarity_cache = {}  # Cache for similarity comparisons between frames
performance_stats = {
    "processed_frames": 0,
    "cached_hits": 0,
    "processing_times": deque(maxlen=50),  # Track the last 50 processing times
    "memory_usage": deque(maxlen=10),      # Track memory usage
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

# Memory monitor
def check_memory_usage():
    """Check current memory usage and return True if it's safe to continue processing"""
    memory_percent = psutil.virtual_memory().percent
    performance_stats["memory_usage"].append(memory_percent)
    return memory_percent < MAX_MEMORY_PERCENT

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

# Create a thread-local landmarker to allow concurrent processing
thread_local = threading.local()

def get_landmarker():
    """Get or create a thread-local landmarker instance"""
    if not hasattr(thread_local, "landmarker"):
        # Adjust options based on MediaPipe version
        try:
            # Create landmarker with newer MediaPipe API
            thread_local.landmarker = mp_vision.PoseLandmarker.create_from_options(
                mp_vision.PoseLandmarkerOptions(
                    base_options=mp_python.BaseOptions(
                        model_asset_path=str(MODEL_PATH), 
                        delegate=_delegate
                    ),
                    running_mode=mp_vision.RunningMode.VIDEO,
                    num_poses=4,  # Allow detecting up to 4 people
                    min_pose_detection_confidence=DETECTION_THRESHOLD,
                    min_pose_presence_confidence=DETECTION_THRESHOLD,
                    min_tracking_confidence=0.5,
                    output_segmentation_masks=False,
                )
            )
        except (TypeError, AttributeError) as e:
            # Fallback for older MediaPipe API
            logger.warning(f"Using fallback MediaPipe API due to: {e}")
            
            # Create pose detector with older MediaPipe API
            thread_local.landmarker = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity={"lite": 0, "full": 1, "heavy": 2}[POSE_MODEL],
                min_detection_confidence=DETECTION_THRESHOLD,
                min_tracking_confidence=0.5
            )
            
    return thread_local.landmarker

# Initialize first landmarker
landmarker = get_landmarker()
logger.info("Landmarker ready (model=%s, delegate=%s)", POSE_MODEL, POSE_DELEGATE)

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
                
            # Clean frame cache if too large or memory is high
            memory_percent = psutil.virtual_memory().percent
            performance_stats["memory_usage"].append(memory_percent)
            
            # More aggressive cleanup if memory usage is high
            target_size = CACHE_SIZE
            if memory_percent > 70:
                target_size = int(CACHE_SIZE * 0.7)  # Reduce to 70% of max if memory is high
            elif memory_percent > 60:
                target_size = int(CACHE_SIZE * 0.8)  # Reduce to 80% of max if memory is moderate
                
            while len(frame_cache) > target_size:
                frame_cache.popitem(last=False)
                
            # Clean similarity cache periodically
            if len(similarity_cache) > 1000:  # Limit similarity cache size
                similarity_cache.clear()
                
            time.sleep(30)  # Run cleanup every 30 seconds
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")

# Start cleanup thread
cleanup_thread = threading.Thread(target=_cleanup_task, daemon=True)
cleanup_thread.start()

# ----------------------------------------------------------------------------
# 🔍 Helper functions
# ----------------------------------------------------------------------------
def _compute_frame_hash(frame: np.ndarray) -> str:
    """Compute a hash for a frame based on downsampled content"""
    # Hash based on downsampled luminance for better comparison
    small = cv2.resize(frame, (32, 32))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    return hashlib.md5(gray.tobytes()).hexdigest()

def _bgr_to_mp_image(frame_bgr: np.ndarray) -> mp.Image:
    """Convert OpenCV BGR image to MediaPipe RGB image"""
    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    try:
        # Try newer MediaPipe API
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    except (TypeError, AttributeError):
        # Return RGB array for older MediaPipe API
        return frame_rgb

# Helper function to draw landmarks using the appropriate MediaPipe version
def draw_landmarks_on_image(image, landmarks, connections, is_selected=False):
    """Draw landmarks and connections on image using the appropriate MediaPipe version"""
    # Choose colors based on selection status
    color = (0, 255, 255) if is_selected else (0, 255, 0)  # Yellow for selected, green for others
    
    # Get image dimensions
    h, w = image.shape[:2]
    
    # First, convert the landmarks to a standardized format
    landmark_points = []
    
    # Handle different landmark formats
    if isinstance(landmarks, list):
        # Direct list of landmarks (newer MediaPipe API)
        if len(landmarks) > 0 and hasattr(landmarks[0], 'x') and hasattr(landmarks[0], 'y'):
            # It's already a list of landmark objects
            landmark_points = landmarks
        else:
            # Empty or unexpected format
            logger.warning(f"Unexpected landmark format in list: {type(landmarks[0]) if landmarks else 'empty'}")
            return
    elif hasattr(landmarks, 'landmark'):
        # Object with landmark attribute (older MediaPipe API)
        landmark_points = landmarks.landmark
    else:
        logger.warning(f"Unknown landmark format: {type(landmarks)}")
        return
    
    try:
        # Check if we have the older or newer MediaPipe version for drawing
        if hasattr(mp_drawing, 'draw_landmarks') and isinstance(landmarks, landmark_pb2.NormalizedLandmarkList):
            # Use MediaPipe's built-in drawing for the correct format
            mp_drawing.draw_landmarks(
                image, landmarks, connections,
                mp_drawing.DrawingSpec(color=color, thickness=5, circle_radius=5),
                mp_drawing.DrawingSpec(color=color, thickness=4)
            )
        else:
            # Manual drawing for all other cases
            # Draw keypoints
            for landmark in landmark_points:
                if not hasattr(landmark, 'x') or not hasattr(landmark, 'y'):
                    logger.warning(f"Invalid landmark object: {type(landmark)}")
                    continue
                
                x, y = int(landmark.x * w), int(landmark.y * h)
                cv2.circle(image, (x, y), 10, color, -1)  # Larger circles for better visibility
            
            # Draw connections if they exist
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
                    
                    cv2.line(image, start_point, end_point, color, 4)  # Thicker lines
    except Exception as e:
        logger.error(f"Error drawing landmarks: {e}")
        # Fallback to minimal drawing if an error occurs
        try:
            cv2.putText(image, "Error drawing landmarks", (int(w/2)-100, int(h/2)), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        except:
            pass

def _landmarks_to_json(lms) -> List[dict[str, float]]:
    """Convert landmarks to JSON-serializable format"""
    # Check if we're dealing with the newer or older MediaPipe API
    if isinstance(lms, list):
        # Newer MediaPipe API returns a list of landmarks
        return [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} for lm in lms]
    elif hasattr(lms, 'landmark'):
        # Older MediaPipe API returns an object with a landmark attribute
        return [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} for lm in lms.landmark]
    else:
        # Fallback if the structure is unknown
        return []

def _add_performance_stat(processing_time: int):
    """Record a processing time for performance tracking"""
    performance_stats["processing_times"].append(processing_time)
    performance_stats["processed_frames"] += 1

def _get_avg_processing_time() -> float:
    """Get average processing time over the last N frames"""
    if not performance_stats["processing_times"]:
        return 0.0
    return sum(performance_stats["processing_times"]) / len(performance_stats["processing_times"])

# ----------------------------------------------------------------------------
# 🏃 Processing
# ----------------------------------------------------------------------------
def _process(frame: np.ndarray, draw: bool, ret_img: bool, overlay: bool, click_point=None) -> dict[str, Any]:
    """Process a single frame for pose detection"""
    t0 = time.time()
    
    # Get a hash of the frame for caching
    frame_hash = _compute_frame_hash(frame)
    
    # Return cached result if available
    if frame_hash in frame_cache:
        performance_stats["cached_hits"] += 1
        return frame_cache[frame_hash]
    
    # Resize if frame is too large
    h, w = frame.shape[:2]
    logger.info(f"Processing frame with shape: {frame.shape}, click_point: {click_point}")
    max_side = max(h, w)
    if max_side > MAX_RESIZE_SIDE:
        scale = MAX_RESIZE_SIDE / max_side
        new_w, new_h = int(w * scale), int(h * scale)
        frame = cv2.resize(frame, (new_w, new_h))
        h, w = new_h, new_w
        logger.info(f"Resized frame to: {new_w}x{new_h}")
    
    # Convert to MediaPipe image
    mp_img = _bgr_to_mp_image(frame)
    
    # Process with landmarker
    landmarker = get_landmarker()
    logger.info(f"Using landmarker: {landmarker}")
    
    # Check which MediaPipe API we're using
    is_older_api = not hasattr(landmarker, 'detect_for_video')
    
    if is_older_api:
        # Older MediaPipe API
        logger.info("Using older MediaPipe API")
        result = landmarker.process(mp_img)
        pose_landmarks = [result.pose_landmarks] if result.pose_landmarks else []
    else:
        # Newer MediaPipe API
        logger.info("Using newer MediaPipe API")
        try:
            result = landmarker.detect_for_video(mp_img, next(_timestamp_ms))
            pose_landmarks = result.pose_landmarks
        except AttributeError:
            # Fallback to newer API without timestamp
            logger.info("Falling back to newer API without timestamp")
            result = landmarker.detect(mp_img)
            pose_landmarks = result.pose_landmarks
    
    # Prepare poses data
    poses_data = []
    logger.info(f"Detected {len(pose_landmarks) if pose_landmarks else 0} poses")
    
    # Process detected poses and find the closest to click_point if provided
    closest_pose_idx = None
    min_distance = float('inf')
    closest_pose_score = 0
    
    for i, pose_landmark in enumerate(pose_landmarks):
        # Convert landmarks to more usable format
        landmarks_data = []
        
        # Handle different landmark formats
        if isinstance(pose_landmark, list):
            # It's already a list of landmarks
            for lm in pose_landmark:
                landmarks_data.append({"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility})
        elif hasattr(pose_landmark, 'landmark'):
            # It has a landmark attribute (older API)
            landmarks_data = [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} 
                             for lm in pose_landmark.landmark]
        else:
            # Direct access to landmarks (newer API)
            landmarks_data = [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} 
                             for lm in pose_landmark]
        
        # Skip if no landmarks detected
        if not landmarks_data:
            logger.warning(f"No landmarks data for pose {i}")
            continue
            
        # Calculate bounding box
        x_coords = [lm["x"] for lm in landmarks_data]
        y_coords = [lm["y"] for lm in landmarks_data]
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)
        
        # Calculate center point of the pose
        center_x = (x_min + x_max) / 2
        center_y = (y_min + y_max) / 2
        
        # Calculate average visibility as a quality metric
        visibilities = [lm.get("visibility", 0) for lm in landmarks_data]
        avg_visibility = sum(visibilities) / len(visibilities) if visibilities else 0
        
        logger.info(f"Pose {i} - bbox: ({x_min:.2f},{y_min:.2f}) to ({x_max:.2f},{y_max:.2f}), visibility: {avg_visibility:.2f}")
        
        # Add pose data
        pose_info = {
            "landmarks": landmarks_data,
            "bbox": {
                "x_min": x_min,
                "y_min": y_min,
                "x_max": x_max,
                "y_max": y_max,
                "width": x_max - x_min,
                "height": y_max - y_min,
                "center_x": center_x,
                "center_y": center_y,
            },
            "visibility_score": avg_visibility
        }
        
        poses_data.append(pose_info)
            
        # If click point provided, calculate distance to this pose
        if click_point:
            click_x, click_y = click_point
            # Normalize click coordinates
            norm_click_x = click_x / w
            norm_click_y = click_y / h
            
            # Расширенная логика для определения ближайшего танцора:
            # 1. Проверяем, находится ли точка клика внутри bbox танцора
            is_inside_bbox = (
                x_min <= norm_click_x <= x_max and 
                y_min <= norm_click_y <= y_max
            )
            
            # 2. Рассчитываем расстояние до центра танцора
            dist_to_center = ((center_x - norm_click_x) ** 2 + (center_y - norm_click_y) ** 2) ** 0.5
            
            # 3. Рассчитываем расстояние до ближайшей ключевой точки
            min_keypoint_dist = float('inf')
            for lm in landmarks_data:
                lm_dist = ((lm["x"] - norm_click_x) ** 2 + (lm["y"] - norm_click_y) ** 2) ** 0.5
                min_keypoint_dist = min(min_keypoint_dist, lm_dist)
            
            # 4. Комбинированная оценка с учетом размера танцора и видимости
            pose_size = ((x_max - x_min) ** 2 + (y_max - y_min) ** 2) ** 0.5
            pose_score = avg_visibility * (0.7 + pose_size * 0.3)  # Больше предпочтение большим и видимым танцорам
            
            # Значительно повышаем шанс выбора танцора, если клик внутри его bbox
            if is_inside_bbox:
                dist_score = 0.2 * dist_to_center
            else:
                dist_score = dist_to_center
            
            # Приоритет танцоров: внутри bbox > большая видимость > расстояние
            final_score = dist_score * (1.0 - pose_score)
            
            logger.info(f"Dancer {i}: inside_bbox={is_inside_bbox}, dist={dist_to_center:.3f}, score={pose_score:.3f}, final={final_score:.3f}")
            
            if is_inside_bbox and (closest_pose_idx is None or pose_score > closest_pose_score):
                closest_pose_idx = i
                closest_pose_score = pose_score
                logger.info(f"Selected dancer {i} as inside bbox with score {pose_score:.3f}")
            elif closest_pose_idx is None or final_score < min_distance:
                closest_pose_idx = i
                min_distance = final_score
                closest_pose_score = pose_score
                logger.info(f"Selected dancer {i} as closest with distance {final_score:.3f}")
    
    # Prepare result dictionary
    res = {
        "poses": poses_data,
        "frame_width": w,
        "frame_height": h,
        "num_poses": len(poses_data),
        "processing_time_ms": int((time.time() - t0) * 1000),
    }
    
    # If click point was provided, include the closest pose
    if click_point and closest_pose_idx is not None:
        res["selected_pose_index"] = closest_pose_idx
        logger.info(f"Final selected pose: {closest_pose_idx}")
    elif click_point:
        logger.warning("No pose selected for click point")
    
    # Draw landmarks on image if requested
    if (draw or overlay) and ret_img:
        logger.info(f"Drawing landmarks with draw={draw}, overlay={overlay}")
        if overlay:
            # Create a BGR image for MediaPipe drawing
            img_out_bgr = np.zeros((h, w, 3), dtype=np.uint8)  # BGR for drawing
            
            for i, pose_landmark in enumerate(pose_landmarks):
                # Draw only the closest pose if one was clicked
                if click_point is not None and i != closest_pose_idx:
                    continue
                    
                # Draw landmarks using appropriate function
                connections = mp_pose.POSE_CONNECTIONS
                draw_landmarks_on_image(img_out_bgr, pose_landmark, connections, i == closest_pose_idx)
            
            # Convert BGR to RGBA for web display
            img_out = np.zeros((h, w, 4), dtype=np.uint8)  # RGBA for display
            img_out[:, :, 0:3] = img_out_bgr  # Copy RGB channels
            img_out[:, :, 3] = 255  # Full opacity where landmarks are drawn
            
            # Set transparent background where no drawings
            drawing_mask = np.any(img_out_bgr > 0, axis=2)
            img_out[~drawing_mask, 3] = 0  # Transparent where no drawing
                
            res["image"] = "data:image/png;base64," + _encode_png(img_out)
            logger.info("Added PNG image with landmarks to result")
        else:
            # Draw on original image
            img_out = frame.copy()
            for i, pose_landmark in enumerate(pose_landmarks):
                # Draw only the closest pose if one was clicked
                if click_point is not None and i != closest_pose_idx:
                    continue
                    
                # Draw landmarks using appropriate function
                connections = mp_pose.POSE_CONNECTIONS
                draw_landmarks_on_image(img_out, pose_landmark, connections, i == closest_pose_idx)
                
            res["image"] = "data:image/jpeg;base64," + _encode_jpeg(img_out, JPEG_Q)
            logger.info("Added JPEG image with landmarks to result")
    
    # Record performance stats and cache the result
    _add_performance_stat(res["processing_time_ms"])
    frame_cache[frame_hash] = res
    
    logger.info(f"Returning result with {len(poses_data)} poses, selected_index={res.get('selected_pose_index')}")
    return res

# ----------------------------------------------------------------------------
# 🌐 FastAPI
# ----------------------------------------------------------------------------
app = FastAPI(title="Dancer Detector API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process-frame")
async def process_frame(
    file: UploadFile = File(...),
    image: int = Query(1, description="Return image 0/1"),
    draw: int = Query(1, description="Draw landmarks on image 0/1"),
    overlay: int = Query(1, description="Return skeleton-only PNG with alpha 0/1"),
    resize: int = Query(1, description="Resize large frames for better performance 0/1"),
    click_x: int = Query(None, description="X coordinate of the click point"),
    click_y: int = Query(None, description="Y coordinate of the click point"),
    response: Response = None,
    x_forwarded_for: str = Header(None),
):
    """Process a video frame to detect poses"""
    logger.info(f"Received request: click_x={click_x}, click_y={click_y}, image={image}, draw={draw}, overlay={overlay}")
    
    # Simple rate limiting by IP
    client_ip = x_forwarded_for or "unknown"
    current_time = time.time()
    
    # Check if this IP is making too many requests
    if client_ip in rate_limiter["requests"]:
        request_count = rate_limiter["requests"][client_ip]
        if request_count > rate_limiter["max_per_minute"]:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return {"error": "Rate limit exceeded. Please try again later."}
        rate_limiter["requests"][client_ip] += 1
    else:
        rate_limiter["requests"][client_ip] = 1
    
    try:
        # Read frame from uploaded file
        contents = await file.read()
        logger.info(f"Read {len(contents)} bytes from uploaded file")
        
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            logger.error("Failed to decode image data")
            return {"error": "Invalid image data"}
            
        logger.info(f"Decoded image with shape: {frame.shape}")
        
        # Ensure image has 3 channels (BGR)
        if len(frame.shape) != 3 or frame.shape[2] != 3:
            logger.warning(f"Image has wrong number of channels: {frame.shape}")
            
            # If image has 4 channels (BGRA), convert to BGR
            if len(frame.shape) == 3 and frame.shape[2] == 4:
                logger.info("Converting BGRA to BGR")
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
            # If image is grayscale, convert to BGR
            elif len(frame.shape) == 2 or (len(frame.shape) == 3 and frame.shape[2] == 1):
                logger.info("Converting grayscale to BGR")
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            else:
                logger.error(f"Unsupported image format with shape {frame.shape}")
                return {"error": "Unsupported image format. Must be RGB or grayscale."}
                
            logger.info(f"After conversion, image shape: {frame.shape}")
        
        # Process the frame with or without click point
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
        
        # Вывод диагностической информации в ответе
        if click_point:
            logger.info(f"Processed click with result: poses={len(result['poses'])}, " +
                      f"selected_idx={result.get('selected_pose_index')}")
            
            # Добавим дополнительную диагностическую информацию в ответ
            result["debug_info"] = {
                "detection_threshold": DETECTION_THRESHOLD,
                "frame_dimensions": (frame.shape[1], frame.shape[0]),
                "click_point": click_point,
                "normalized_click": (click_x / frame.shape[1], click_y / frame.shape[0]),
                "num_poses_detected": len(result["poses"]),
                "selected_pose_index": result.get("selected_pose_index"),
            }
            
            if result.get("selected_pose_index") is not None:
                # Добавим информацию о выбранном танцоре
                selected_pose = result["poses"][result["selected_pose_index"]]
                result["debug_info"]["selected_pose_bbox"] = selected_pose["bbox"]
        
        # Set ETag header for browser caching if enabled
        if USE_ETAG and response:
            result_hash = hashlib.md5(str(result).encode()).hexdigest()
            response.headers["ETag"] = f'W/"{result_hash}"'
            
        logger.info(f"Returning result with {len(result.get('poses', []))} poses")
        return result
        
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}", exc_info=True)
        return {"error": f"Processing failed: {str(e)}"}

@app.get("/health")
async def health():
    """Check the health of the service"""
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
    """Clear all caches"""
    frame_cache.clear()
    similarity_cache.clear()
    return {"status": "ok", "message": "Cache cleared successfully"}
