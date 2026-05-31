import sys
import os
from pathlib import Path
from loguru import logger


def setup_logger(log_level: str = None):
    log_level = log_level or os.getenv("LOG_LEVEL", "INFO")
    log_dir = Path("data/logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stdout,
        level=log_level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        colorize=True,
    )

    logger.add(
        log_dir / "reddit_agent_{time:YYYY-MM-DD}.log",
        level=log_level,
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} - {message}",
        rotation="00:00",
        retention="30 days",
        compression="gz",
    )

    logger.add(
        log_dir / "errors_{time:YYYY-MM-DD}.log",
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} - {message}\n{exception}",
        rotation="00:00",
        retention="60 days",
        compression="gz",
    )

    return logger
