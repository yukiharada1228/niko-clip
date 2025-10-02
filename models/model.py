import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class Model(object):
    def __init__(self, ie_core, model_path, device_name="CPU", num_requests=0):
        net = ie_core.read_model(model_path + ".xml", model_path + ".bin")

        self.exec_net = ie_core.compile_model(model=net, device_name=device_name)

        # Set input name, output name, input size, and output size
        self.input_name = self.exec_net.inputs[0].get_any_name()
        self.output_name = self.exec_net.outputs[0].get_any_name()
        self.input_size = self.exec_net.inputs[0].shape
        self.output_size = self.exec_net.outputs[0].shape

    def prepare_frame(self, frame):
        # Resize to input size, move channel to first, and convert to 4D array
        _, _, h, w = self.input_size
        input_frame = cv2.resize(frame, (h, w)).transpose((2, 0, 1))[np.newaxis]

        logger.debug(
            {
                "action": "prepare_frame",
                "input_size": (h, w),
                "input_frame.shape": input_frame.shape,
            }
        )

        return input_frame

    def infer(self, data):
        input_data = {self.input_name: data}

        infer_result = self.exec_net(input_data)[self.output_name]

        logger.debug(
            {
                "action": "infer",
                "input_data.shape": input_data[self.input_name].shape,
                "infer_result.shape": infer_result.shape,
            }
        )

        return infer_result
