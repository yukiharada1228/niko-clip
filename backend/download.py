import logging
import subprocess

logger = logging.getLogger(__name__)


def download_model(model_name, output_dir):
    logger.info(f"Start downloading model: {model_name} to {output_dir}")
    cmd = (
        "omz_downloader",
        "--name",
        model_name,
        "--output_dir",
        str(output_dir),
    )
    result = subprocess.run(cmd)
    if result.returncode == 0:
        logger.info(f"Successfully downloaded model: {model_name}")
    else:
        logger.error(
            f"Failed to download model: {model_name} (return code: {result.returncode})"
        )


if __name__ == "__main__":
    from pathlib import Path

    import config

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
    )

    project_root = Path(__file__).parent
    models_dir = project_root / "models"
    models_dir.mkdir(exist_ok=True)

    model_names = config.MODEL_NAMES

    for model_name in model_names:
        download_model(model_name, models_dir)
