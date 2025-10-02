"""
ImageService for handling base64 image encoding and validation.
"""

import base64
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from config import MAX_BASE64_IMAGE_SIZE_MB
from schemas import TaskResult

logger = logging.getLogger(__name__)


class ImageProcessingError(Exception):
    """Base exception for image processing errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "IMAGE_PROCESSING_ERROR",
        original_error: Exception = None,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.original_error = original_error


class Base64EncodingError(ImageProcessingError):
    """Raised when base64 encoding fails."""

    def __init__(self, message: str, original_error: Exception = None):
        super().__init__(message, "BASE64_ENCODING_ERROR", original_error)


class ImageSizeError(ImageProcessingError):
    """Raised when image is too large for base64 encoding."""

    def __init__(self, message: str, file_size_mb: float):
        super().__init__(message, "IMAGE_SIZE_ERROR")
        self.file_size_mb = file_size_mb


class ImageValidationError(ImageProcessingError):
    """Raised when image validation fails."""

    def __init__(self, message: str, original_error: Exception = None):
        super().__init__(message, "IMAGE_VALIDATION_ERROR", original_error)


class ImageService:
    """Service for handling image processing and base64 encoding."""

    @staticmethod
    def encode_image_to_base64(image_path: Path) -> str:
        """
        Convert image file to base64 data URI.

        Args:
            image_path: Path to the image file

        Returns:
            Base64 data URI string (e.g., "data:image/jpeg;base64,...")

        Raises:
            Base64EncodingError: If encoding fails
            FileNotFoundError: If image file doesn't exist
        """
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        try:
            # Determine MIME type based on file extension
            extension = image_path.suffix.lower()
            mime_type_map = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".bmp": "image/bmp",
                ".webp": "image/webp",
            }

            mime_type = mime_type_map.get(extension, "image/jpeg")

            # Read and encode the image
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
                base64_string = base64.b64encode(image_data).decode("utf-8")

            return f"data:{mime_type};base64,{base64_string}"

        except Exception as e:
            logger.error(f"Failed to encode image {image_path} to base64: {str(e)}")
            raise Base64EncodingError(f"Base64 encoding failed: {str(e)}", e) from e

    @staticmethod
    def get_image_size_mb(image_path: Path) -> float:
        """
        Get the size of an image file in megabytes.

        Args:
            image_path: Path to the image file

        Returns:
            Size in megabytes

        Raises:
            FileNotFoundError: If image file doesn't exist
        """
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")

        size_bytes = image_path.stat().st_size
        return size_bytes / (1024 * 1024)  # Convert to MB

    @staticmethod
    def should_use_base64(
        image_path: Path, force_fallback: bool = False
    ) -> Dict[str, Any]:
        """
        Determine if image should be base64 encoded with detailed reasoning.

        Args:
            image_path: Path to the image file
            force_fallback: If True, force fallback to URL format

        Returns:
            Dict containing decision and metadata:
            {
                "use_base64": bool,
                "reason": str,
                "file_size_mb": float,
                "error": Optional[str]
            }
        """
        result = {
            "use_base64": False,
            "reason": "unknown",
            "file_size_mb": 0.0,
            "error": None,
        }

        try:
            # Check if file exists and is valid
            if not ImageService.validate_image_file(image_path):
                result["reason"] = "invalid_file"
                result["error"] = f"Image file {image_path} is not valid or accessible"
                logger.error(result["error"])
                return result

            # Check file size
            size_mb = ImageService.get_image_size_mb(image_path)
            result["file_size_mb"] = size_mb

            if force_fallback:
                result["reason"] = "forced_fallback"
                logger.info(f"Forced fallback to URL format for {image_path}")
                return result

            if size_mb > MAX_BASE64_IMAGE_SIZE_MB:
                result["reason"] = "size_limit_exceeded"
                logger.warning(
                    f"Image {image_path} ({size_mb:.2f}MB) exceeds max base64 size "
                    f"({MAX_BASE64_IMAGE_SIZE_MB}MB), falling back to URL format"
                )
                return result

            # All checks passed
            result["use_base64"] = True
            result["reason"] = "size_within_limits"
            logger.debug(
                f"Image {image_path} ({size_mb:.2f}MB) approved for base64 encoding"
            )
            return result

        except Exception as e:
            result["reason"] = "error_checking_file"
            result["error"] = f"Error checking image {image_path}: {str(e)}"
            logger.error(result["error"], exc_info=True)
            return result

    @staticmethod
    def create_task_result_with_fallback(
        image_path: Path, timestamp: str, score: float, task_id: str = None
    ) -> TaskResult:
        """
        Create TaskResult with base64 image data and automatic fallback to URL format.

        Args:
            image_path: Path to the image file
            timestamp: Timestamp string
            score: Smile detection score
            task_id: Task ID for URL generation (optional)

        Returns:
            TaskResult with base64 or URL format based on conditions

        Raises:
            ImageProcessingError: If both base64 and URL fallback fail
        """
        fallback_attempts = []

        try:
            # First attempt: Try base64 encoding
            base64_decision = ImageService.should_use_base64(image_path)

            if base64_decision["use_base64"]:
                try:
                    image_data = ImageService.encode_image_to_base64(image_path)
                    logger.info(
                        f"Successfully created base64 TaskResult for {image_path}"
                    )
                    return TaskResult(
                        timestamp=timestamp, score=score, image_data=image_data
                    )

                except Base64EncodingError as e:
                    fallback_attempts.append(f"Base64 encoding failed: {str(e)}")
                    logger.warning(
                        f"Base64 encoding failed for {image_path}, attempting URL fallback: {str(e)}"
                    )

                except Exception as e:
                    fallback_attempts.append(f"Base64 processing error: {str(e)}")
                    logger.warning(
                        f"Unexpected error during base64 encoding for {image_path}: {str(e)}"
                    )
            else:
                fallback_attempts.append(
                    f"Base64 not suitable: {base64_decision['reason']}"
                )
                logger.info(
                    f"Skipping base64 for {image_path}: {base64_decision['reason']}"
                )

            # Fallback: Create URL-based result
            try:
                # For now, we only support base64, so we'll raise an error
                # In a full implementation, this would create a URL-based TaskResult
                error_details = "; ".join(fallback_attempts)
                raise ImageProcessingError(
                    f"Cannot create TaskResult for {image_path}. Base64 encoding failed and URL fallback not implemented. Details: {error_details}",
                    "FALLBACK_FAILED",
                )

            except Exception as e:
                fallback_attempts.append(f"URL fallback failed: {str(e)}")
                logger.error(f"URL fallback also failed for {image_path}: {str(e)}")

        except Exception as e:
            if not isinstance(e, ImageProcessingError):
                fallback_attempts.append(f"Unexpected error: {str(e)}")
                logger.error(
                    f"Unexpected error in create_task_result_with_fallback for {image_path}: {str(e)}",
                    exc_info=True,
                )

        # If we reach here, all attempts failed
        error_summary = "; ".join(fallback_attempts)
        final_error = ImageProcessingError(
            f"All fallback attempts failed for {image_path}: {error_summary}",
            "ALL_FALLBACKS_FAILED",
        )
        logger.error(str(final_error))
        raise final_error

    @staticmethod
    def create_task_result(
        image_path: Path, timestamp: str, score: float
    ) -> TaskResult:
        """
        Create TaskResult with base64 image data (legacy method for backward compatibility).

        Args:
            image_path: Path to the image file
            timestamp: Timestamp string
            score: Smile detection score

        Returns:
            TaskResult with base64 image data

        Raises:
            ImageProcessingError: If image processing fails
        """
        return ImageService.create_task_result_with_fallback(
            image_path, timestamp, score
        )

    @staticmethod
    def validate_image_file(image_path: Path) -> bool:
        """
        Validate that the file is a supported image format.

        Args:
            image_path: Path to the image file

        Returns:
            True if file is a valid image, False otherwise
        """
        try:
            if not image_path.exists():
                return False

            # Check file extension
            supported_extensions = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}
            if image_path.suffix.lower() not in supported_extensions:
                return False

            # Basic file size check (not empty, not too large)
            size_bytes = image_path.stat().st_size
            if size_bytes == 0:
                return False

            # Check if file is readable
            try:
                with open(image_path, "rb") as f:
                    # Read first few bytes to ensure it's accessible
                    f.read(10)
                return True
            except Exception:
                return False

        except Exception as e:
            logger.error(f"Error validating image file {image_path}: {str(e)}")
            return False

    @staticmethod
    def get_user_friendly_error_message(error: ImageProcessingError) -> Dict[str, Any]:
        """
        Convert technical error to user-friendly message.

        Args:
            error: ImageProcessingError instance

        Returns:
            Dict with user-friendly error information
        """
        error_messages = {
            "BASE64_ENCODING_ERROR": {
                "message": "画像の処理中にエラーが発生しました。",
                "suggestion": "別の画像を試すか、しばらく時間をおいて再試行してください。",
                "retryable": True,
            },
            "IMAGE_SIZE_ERROR": {
                "message": f"画像ファイルが大きすぎます（制限: {MAX_BASE64_IMAGE_SIZE_MB}MB）。",
                "suggestion": "より小さな画像を使用するか、画像を圧縮してください。",
                "retryable": False,
            },
            "IMAGE_VALIDATION_ERROR": {
                "message": "サポートされていない画像形式です。",
                "suggestion": "JPEG、PNG、GIF、BMP、WebP形式の画像を使用してください。",
                "retryable": False,
            },
            "FALLBACK_FAILED": {
                "message": "画像の処理に失敗しました。",
                "suggestion": "画像ファイルが破損していないか確認し、再試行してください。",
                "retryable": True,
            },
            "ALL_FALLBACKS_FAILED": {
                "message": "画像の処理ができませんでした。",
                "suggestion": "別の画像を使用するか、サポートにお問い合わせください。",
                "retryable": False,
            },
        }

        error_info = error_messages.get(
            error.error_code,
            {
                "message": "予期しないエラーが発生しました。",
                "suggestion": "しばらく時間をおいて再試行してください。",
                "retryable": True,
            },
        )

        return {
            "error_code": error.error_code,
            "technical_message": str(error),
            "user_message": error_info["message"],
            "suggestion": error_info["suggestion"],
            "retryable": error_info["retryable"],
            "original_error": (
                str(error.original_error) if error.original_error else None
            ),
        }
