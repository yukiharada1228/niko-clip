"""
Models package for smile detection application.

This package contains all the model-related classes for face detection
and emotion recognition using OpenVINO.
"""

from .emotions_recognizer import EmotionsRecognizer, SmileRecognizer
from .face_detector import FaceDetector
from .model import Model

__all__ = ["Model", "FaceDetector", "EmotionsRecognizer", "SmileRecognizer"]
