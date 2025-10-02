import logging

import cv2
from openvino.runtime import Core

import config
from models import FaceDetector, SmileRecognizer

logger = logging.getLogger(__name__)


class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            logger.debug(f"Creating a new instance of {cls.__name__}")
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        else:
            logger.debug(f"Using existing instance of {cls.__name__}")
        return cls._instances[cls]


class Camera(metaclass=Singleton):
    def __init__(self, device_id=None):
        if device_id is None:
            device_id = config.CAMERA_DEVICE_ID
        logger.info(f"Initializing camera with device_id={device_id}")
        self.cap = cv2.VideoCapture(device_id)
        if not self.cap.isOpened():
            logger.error(f"Could not open video device {device_id}")
            raise ValueError(f"Could not open video device {device_id}")
        logger.info(f"Camera with device_id={device_id} opened successfully")

    def get_frame(self):
        logger.debug("Attempting to read a frame from the camera")
        ret, frame = self.cap.read()
        if not ret:
            logger.error("Could not read frame")
            raise ValueError("Could not read frame")
        logger.debug("Frame read successfully")
        return frame

    def release(self):
        if hasattr(self, "cap") and self.cap.isOpened():
            logger.info("Releasing camera resource")
            self.cap.release()

    def __del__(self):
        self.release()


def camera_decorator(device_id=None, delay=None, window_name=None):
    def decorator(process_func):
        def wrapper(*args, **kwargs):
            # Set default values
            _device_id = device_id if device_id is not None else config.CAMERA_DEVICE_ID
            _delay = delay if delay is not None else config.CAMERA_DELAY
            _window_name = (
                window_name if window_name is not None else config.CAMERA_WINDOW_NAME
            )

            cam = Camera(_device_id)
            try:
                while cam.cap.isOpened():
                    frame = cam.get_frame()
                    processed = process_func(frame, *args, **kwargs)
                    cv2.imshow(_window_name, processed)
                    logger.debug({"frame.shape": processed.shape})
                    key = cv2.waitKey(_delay)
                    if key == config.ESC_KEYCODE:
                        logger.info("ESC key pressed. Exiting.")
                        break
            except KeyboardInterrupt as ex:
                logger.warning({"ex": ex})
            finally:
                cam.release()
                cv2.destroyAllWindows()

        return wrapper

    return decorator


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    ie_core = Core()
    face_detector = FaceDetector(ie_core, config.FACE_DETECTION_MODEL_PATH)
    emotions_recognizer = SmileRecognizer(
        ie_core, config.EMOTIONS_RECOGNITION_MODEL_PATH
    )

    @camera_decorator()
    def process(frame):

        input_frame = face_detector.prepare_frame(frame)
        result = face_detector.infer(input_frame)
        faces = face_detector.prepare_data(result, frame)

        frame_with_emotions = frame.copy()

        for face in faces:
            xmin = face["xmin"]
            ymin = face["ymin"]
            xmax = face["xmax"]
            ymax = face["ymax"]

            face_crop = frame[int(ymin) : int(ymax), int(xmin) : int(xmax)]

            if face_crop.size > 0:
                emotions_input = emotions_recognizer.prepare_frame(face_crop)
                emotions_result = emotions_recognizer.infer(emotions_input)
                emotions_score = emotions_recognizer.score(emotions_result)

                frame_with_emotions = emotions_recognizer.draw(
                    xmin, ymin, xmax, ymax, emotions_score, frame_with_emotions
                )

        return frame_with_emotions

    process()
