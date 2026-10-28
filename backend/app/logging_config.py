import logging
import logging.handlers
from .settings import settings


def setup_logging(level: int | None = None) -> None:
    if level is None:
        level = getattr(logging, settings.log_level, logging.INFO)

    settings.log_dir.mkdir(exist_ok=True)
    root = logging.getLogger()
    root.setLevel(level)

    # Убираем дефолтные хендлеры, чтобы не дублировать
    for h in list(root.handlers):
        root.removeHandler(h)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Консоль
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.addHandler(console)

    # Файл с ротацией: 5 МБ × 5 файлов
    file_handler = logging.handlers.RotatingFileHandler(
        settings.log_dir / "petroviz.log",
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    # Приглушаем болтливые библиотеки
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("multipart").setLevel(logging.WARNING)
    logging.getLogger("lasio").setLevel(logging.WARNING)