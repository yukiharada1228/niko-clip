"""Repository for managing task states using Redis."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import redis

import config

logger = logging.getLogger(__name__)


class TaskNotFoundError(Exception):
    """Exception raised when the requested task does not exist."""


class TaskRepository:
    """Repository for storing and retrieving task information in Redis."""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        if redis_client is not None:
            self._redis = redis_client
        else:
            logger.info("Connecting to Redis at %s", config.REDIS_URL)
            self._redis = redis.from_url(config.REDIS_URL, decode_responses=True)

    def create_task(self, task_id: str, payload: Dict[str, Any]) -> None:
        """Create a task and set its TTL."""

        data = {"status": "processing", **payload}
        pipe = self._redis.pipeline()
        pipe.hset(self._task_key(task_id), mapping=data)
        pipe.expire(self._task_key(task_id), config.REDIS_TASK_TTL_SECONDS)
        pipe.execute()

    def update_task(self, task_id: str, payload: Dict[str, Any]) -> None:
        """Update task information."""

        if not self._redis.exists(self._task_key(task_id)):
            raise TaskNotFoundError(task_id)

        self._redis.hset(self._task_key(task_id), mapping=payload)

    def append_task_results(self, task_id: str, results: Any) -> None:
        """Store task results as JSON."""

        if not self._redis.exists(self._task_key(task_id)):
            raise TaskNotFoundError(task_id)

        self._redis.hset(self._task_key(task_id), "results", json.dumps(results))

    def get_task(self, task_id: str) -> Dict[str, Any]:
        """Retrieve task information or raise TaskNotFoundError if missing."""

        data = self._redis.hgetall(self._task_key(task_id))
        if not data:
            raise TaskNotFoundError(task_id)

        results_raw = data.get("results")
        if results_raw:
            data["results"] = json.loads(results_raw)

        if "progress" in data:
            data["progress"] = int(data["progress"])

        if "created_at" in data:
            data["created_at"] = float(data["created_at"])

        return data

    def delete_task(self, task_id: str) -> None:
        """Delete task information."""

        self._redis.delete(self._task_key(task_id))

    @staticmethod
    def _task_key(task_id: str) -> str:
        return f"tasks:{task_id}"
