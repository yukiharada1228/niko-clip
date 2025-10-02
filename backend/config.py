import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Camera settings
CAMERA_DEVICE_ID = int(os.getenv("CAMERA_DEVICE_ID", "0"))
CAMERA_DELAY = 1
CAMERA_WINDOW_NAME = "frame"
ESC_KEYCODE = 27

# OpenVINO model names
MODEL_NAMES = ["face-detection-retail-0005", "emotions-recognition-retail-0003"]

# Model paths
PROJECT_ROOT = Path(__file__).parent
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "/tmp/uploads"))
FACE_DETECTION_MODEL_PATH = str(
    PROJECT_ROOT
    / "models"
    / "intel"
    / "face-detection-retail-0005"
    / "FP32"
    / "face-detection-retail-0005"
)
EMOTIONS_RECOGNITION_MODEL_PATH = str(
    PROJECT_ROOT
    / "models"
    / "intel"
    / "emotions-recognition-retail-0003"
    / "FP32"
    / "emotions-recognition-retail-0003"
)


# Image response format settings (base64 only)
MAX_BASE64_IMAGE_SIZE_MB = int(
    os.getenv("MAX_BASE64_IMAGE_SIZE_MB", "5")
)  # Maximum size for base64 encoding


# Redis settings
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
REDIS_TASK_TTL_SECONDS = int(os.getenv("REDIS_TASK_TTL_SECONDS", "86400"))
