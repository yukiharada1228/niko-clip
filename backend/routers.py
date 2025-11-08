import logging
import pathlib
import shutil
import time
import uuid
from typing import Dict, List, Optional

import cv2
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from openvino.runtime import Core

# Import project modules
import config
from models.emotions_recognizer import SMILE_INDEX, SmileRecognizer
from models.face_detector import FaceDetector
from schemas import TaskCreateResponse, TaskResult, TaskStatus
from services import (ImageProcessingError, ImageService, TaskNotFoundError,
                      TaskRepository)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# --- TASK STORAGE ---
task_repository = TaskRepository()


# --- MODEL INITIALIZATION (global for efficiency) ---
ie_core = Core()
face_detector = FaceDetector(ie_core, config.FACE_DETECTION_MODEL_PATH)
emotions_recognizer = SmileRecognizer(ie_core, config.EMOTIONS_RECOGNITION_MODEL_PATH)


def select_diverse_candidates(candidates, time_threshold=1.0):
    """
    Selects a diverse set of smile candidates based on time.

    Args:
        candidates: A list of smile candidates, sorted by score.
        time_threshold: The minimum time gap between selected candidates.

    Returns:
        A list of diverse candidates.
    """
    if not candidates:
        return []

    selected_candidates = []
    used_time_ranges = []

    for candidate in candidates:
        candidate_time = candidate["timestamp"]
        is_diverse = True
        for start_time, end_time in used_time_ranges:
            if start_time <= candidate_time <= end_time:
                is_diverse = False
                break

        if is_diverse:
            selected_candidates.append(candidate)
            range_start = max(0, candidate_time - time_threshold / 2)
            range_end = candidate_time + time_threshold / 2
            used_time_ranges.append((range_start, range_end))

    return selected_candidates


def _compute_frame_skip(fps: float) -> int:
    interval_seconds = max(config.FRAME_SAMPLE_INTERVAL_SECONDS, 0)
    if interval_seconds == 0:
        return 1
    return max(1, int(fps * interval_seconds))


def _update_task_progress(task_id: str, frame_number: int, total_frames: int) -> bool:
    if total_frames <= 0:
        return True

    progress = int((frame_number / total_frames) * 100)
    try:
        task_repository.update_task(task_id, {"progress": progress})
        return True
    except TaskNotFoundError:
        logger.warning(
            "Task %s no longer exists while updating progress", task_id
        )
        return False


def _extract_smile_candidates(
    frame, frame_number: int, fps: float
) -> List[Dict[str, object]]:
    input_frame = face_detector.prepare_frame(frame)
    face_result = face_detector.infer(input_frame)
    faces = face_detector.prepare_data(face_result, frame)

    candidates: List[Dict[str, object]] = []
    timestamp = frame_number / fps if fps else 0.0

    for face in faces:
        face_crop = frame[face["ymin"] : face["ymax"], face["xmin"] : face["xmax"]]
        if face_crop.size == 0:
            continue

        emotions_input = emotions_recognizer.prepare_frame(face_crop)
        emotions_result = emotions_recognizer.infer(emotions_input)
        emotions_score = emotions_recognizer.score(emotions_result)
        smile_score = emotions_score[SMILE_INDEX]

        if smile_score > 0.6:
            candidates.append(
                {
                    "smile_score": float(smile_score),
                    "timestamp": timestamp,
                    "frame": frame.copy(),
                }
            )

    return candidates


def _create_task_result(
    task_id: str, candidate: Dict[str, object], index: int
) -> Optional[TaskResult]:
    image_filename = f"scene_{index + 1}.jpg"
    timestamp_str = f'{candidate["timestamp"]:.2f}s'
    temp_image_path = pathlib.Path(f"temp_{task_id}_{image_filename}")

    cv2.imwrite(str(temp_image_path), candidate["frame"])

    try:
        task_result = ImageService.create_task_result_with_fallback(
            image_path=temp_image_path,
            timestamp=timestamp_str,
            score=candidate["smile_score"],
            task_id=task_id,
        )
        return task_result
    except Exception as exc:
        if isinstance(exc, ImageProcessingError):
            error_info = ImageService.get_user_friendly_error_message(exc)
            logger.error(
                "Failed to create result for %s: %s (User message: %s)",
                image_filename,
                error_info["technical_message"],
                error_info["user_message"],
            )
        else:
            logger.error(
                "Unexpected error creating result for %s: %s",
                image_filename,
                exc,
                exc_info=True,
            )
        return None
    finally:
        if temp_image_path.exists():
            temp_image_path.unlink()


def _finalize_smile_results(task_id: str, smile_candidates: List[Dict[str, object]]):
    if not smile_candidates:
        try:
            task_repository.append_task_results(task_id, [])
            task_repository.update_task(task_id, {"status": "complete"})
        except TaskNotFoundError:
            logger.warning(
                "Task %s no longer exists while finalizing empty results", task_id
            )
        return

    smile_candidates.sort(key=lambda candidate: candidate["smile_score"], reverse=True)
    top_smiles = select_diverse_candidates(smile_candidates, time_threshold=1.0)

    final_results: List[TaskResult] = []
    for index, candidate in enumerate(top_smiles):
        task_result = _create_task_result(task_id, candidate, index)
        if task_result:
            final_results.append(task_result)

    results_payload = [result.dict() for result in final_results]
    try:
        task_repository.append_task_results(task_id, results_payload)
        task_repository.update_task(
            task_id, {"status": "complete", "progress": 100}
        )
    except TaskNotFoundError:
        logger.warning(
            "Task %s no longer exists while storing final results", task_id
        )


def _handle_processing_exception(task_id: str, error: Exception):
    try:
        task_repository.update_task(
            task_id,
            {
                "status": "error",
                "error": str(error),
            },
        )
    except TaskNotFoundError:
        logger.warning(
            "Task %s no longer exists while recording error state", task_id
        )


def _cleanup_video_file(video_path: str):
    video = pathlib.Path(video_path)
    if video.exists():
        video.unlink()


def process_video_task(task_id: str, video_path: str):
    """
    Processes a video file to find diverse, high-quality smile scenes and
    updates the task status with progress. Results are returned in base64 format.

    Args:
        task_id: Unique identifier for the task
        video_path: Path to the video file to process
    """
    cap = None
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps == 0:
            fps = 30  # Assume 30 FPS if not available

        frame_skip = _compute_frame_skip(fps)

        smile_candidates = []
        frame_number = 0

        while cap.isOpened():
            if not cap.grab():
                break

            # --- Progress Update ---
            if not _update_task_progress(task_id, frame_number, total_frames):
                return

            if frame_number % frame_skip == 0:
                ret, frame = cap.retrieve()
                if not ret:
                    logger.warning("Failed to retrieve frame %s", frame_number)
                else:
                    smile_candidates.extend(
                        _extract_smile_candidates(frame, frame_number, fps)
                    )

            frame_number += 1

        _finalize_smile_results(task_id, smile_candidates)

    except Exception as exc:
        _handle_processing_exception(task_id, exc)
    finally:
        if cap is not None:
            cap.release()
        _cleanup_video_file(video_path)


# --- API ENDPOINTS ---
@router.get("/health")
async def health():
    return {"status": "healthy"}


@router.post("/tasks", response_model=TaskCreateResponse)
async def create_task(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """Create a new video processing task."""
    task_id = str(uuid.uuid4())
    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    upload_path = config.UPLOADS_DIR / f"{task_id}_{file.filename}"

    with upload_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Initialize task with progress 0
    task_repository.create_task(
        task_id,
        {
            "filename": file.filename,
            "progress": 0,
            "created_at": time.time(),
        },
    )

    background_tasks.add_task(process_video_task, task_id, str(upload_path))

    return TaskCreateResponse(task_id=task_id, status="processing")


@router.get("/tasks/{task_id}", response_model=TaskStatus)
async def get_task(task_id: str):
    """Get task status and results (base64 format only)."""
    try:
        task = task_repository.get_task(task_id)
    except TaskNotFoundError:
        raise HTTPException(status_code=404, detail="Task not found")

    # Convert results to Pydantic models if they exist
    if task.get("results") and isinstance(task["results"], list):
        if task["results"] and isinstance(task["results"][0], dict):
            # Convert dict results to TaskResult objects
            task["results"] = [TaskResult(**result) for result in task["results"]]

    return TaskStatus(**task)
