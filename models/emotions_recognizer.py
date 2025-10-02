import logging

import cv2 as cv
import numpy as np

from .model import Model

logger = logging.getLogger(__name__)

NEUTRAL_INDEX = 0
SMILE_INDEX = 1
COLOR_PICKER = [
    (255, 0, 0),
    (0, 255, 255),
    (0, 255, 0),
    (255, 0, 255),
    (0, 0, 255),
]


class EmotionsRecognizer(Model):
    def __init__(self, ie_core, model_path, device_name="CPU", num_requests=0):
        super(EmotionsRecognizer, self).__init__(
            ie_core=ie_core,
            model_path=model_path,
            device_name=device_name,
            num_requests=num_requests,
        )

    def score(self, infer_result):
        # Squeeze the inference result to get the emotion scores
        emotions_score = np.squeeze(infer_result)
        return emotions_score

    def get_color(self, emotions_score):
        """Get color from emotion score"""
        emotion = np.argmax(emotions_score)
        return COLOR_PICKER[emotion]

    def draw(self, xmin, ymin, xmax, ymax, emotions_score, frame, smile_mode=False):
        # Draw rectangle on the frame based on emotion color
        dest = frame.copy()
        color = self.get_color(emotions_score)
        cv.rectangle(
            dest,
            (int(xmin), int(ymin)),
            (int(xmax), int(ymax)),
            color=color,
            thickness=3,
        )
        logger.debug(
            {
                "action": "draw",
                "dest.shape": dest.shape,
            }
        )
        return dest


class SmileRecognizer(EmotionsRecognizer):
    def __init__(self, ie_core, model_path, device_name="CPU", num_requests=0):
        super(SmileRecognizer, self).__init__(
            ie_core=ie_core,
            model_path=model_path,
            device_name=device_name,
            num_requests=num_requests,
        )

    def get_color(self, emotions_score):
        """Get color for smile detection (yellow for smile, blue for others)"""
        emotion = np.argmax(emotions_score)
        if emotion == SMILE_INDEX:
            return COLOR_PICKER[SMILE_INDEX]
        else:
            return COLOR_PICKER[NEUTRAL_INDEX]
