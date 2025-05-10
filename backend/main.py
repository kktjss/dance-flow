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
from typing import Any, List

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, Query
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
    ok, buf = cv2.imencode(".png", img_bgra)
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
JPEG_Q = int(os.getenv("JPEG_Q", "70"))
MODEL_DIR = Path(os.getenv("MODEL_DIR", ".models"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

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
landmarker = mp_vision.PoseLandmarker.create_from_options(
    mp_vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=str(MODEL_PATH), delegate=_delegate),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_poses=1,
        output_segmentation_masks=False,
    )
)
logger.info("Landmarker ready (model=%s, delegate=%s, VIDEO mode)", POSE_MODEL, POSE_DELEGATE)

_timestamp_ms = itertools.count(0, 33)  # ~30 fps timestamps

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def _bgr_to_mp_image(frame_bgr: np.ndarray) -> mp.Image:
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    if _delegate == mp_python.BaseOptions.Delegate.CPU and max(rgb.shape[:2]) > TARGET_SIDE:
        h, w = rgb.shape[:2]
        scale = TARGET_SIDE / max(h, w)
        rgb = cv2.resize(rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)


def _landmarks_to_json(lms) -> List[dict[str, float]]:
    return [{"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility} for lm in lms]


# ----------------------------------------------------------------------------
# Core processing
# ----------------------------------------------------------------------------

def _process(frame: np.ndarray, draw: bool, ret_img: bool, overlay: bool) -> dict[str, Any]:
    ts = next(_timestamp_ms)
    start = time.perf_counter()
    res = landmarker.detect_for_video(_bgr_to_mp_image(frame), ts)
    elapsed = int((time.perf_counter() - start) * 1000)

    if not res.pose_landmarks:
        return {"success": False, "processing_ms": elapsed, "message": "No pose"}

    payload: dict[str, Any] = {
        "success": True,
        "processing_ms": elapsed,
        "landmarks": _landmarks_to_json(res.pose_landmarks[0]),
    }

    if ret_img:
        if overlay:
            h, w = frame.shape[:2]
            canvas = np.zeros((h, w, 4), dtype=np.uint8)  # BGRA
            proto = landmark_pb2.NormalizedLandmarkList()
            proto.landmark.extend(
                landmark_pb2.NormalizedLandmark(x=lm.x, y=lm.y, z=lm.z, visibility=lm.visibility)
                for lm in res.pose_landmarks[0]
            )
            mp_drawing.draw_landmarks(
                canvas[:, :, :3],  # BGR view
                proto,
                mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2),
            )
            canvas[:, :, 3] = np.where(canvas[:, :, :3].any(axis=2), 255, 0)  # alpha
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
    overlay: int = Query(0, description="Return skeleton-only PNG with alpha 0/1"),
):
    raw = await file.read()
    frame = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return {"success": False, "message": "Bad image"}
    return await asyncio.to_thread(_process, frame, bool(draw), bool(image), bool(overlay))


@app.get("/health")
async def health():
    return {"status": "ok"}
