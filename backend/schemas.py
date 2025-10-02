from typing import List, Literal, Optional

from pydantic import BaseModel, validator


class TaskCreateResponse(BaseModel):
    """Response schema for task creation."""

    task_id: str
    status: str


class TaskResult(BaseModel):
    """Schema for individual smile detection result."""

    timestamp: str
    score: float
    image_data: str  # Base64 data URI: "data:image/jpeg;base64,..."

    @validator("image_data")
    def validate_base64_format(cls, v):
        """Validate that image_data is a proper data URI format."""
        if not v.startswith("data:image/"):
            raise ValueError(
                'image_data must be a valid data URI starting with "data:image/"'
            )
        return v


class TaskStatus(BaseModel):
    """Schema for task status and progress."""

    status: str
    filename: Optional[str] = None
    progress: Optional[int] = None
    created_at: Optional[float] = None
    results: Optional[List[TaskResult]] = None
    error: Optional[str] = None
