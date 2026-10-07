import logging
from typing import Optional

logger = logging.getLogger("petroviz.storage")


class WellRepository:
    """
    Хранилище скважин. Сейчас — в памяти процесса.

    Интерфейс (add/get/exists) спроектирован так, чтобы позже
    безболезненно заменить реализацию на PostgreSQL или Redis.
    """

    def __init__(self) -> None:
        self._store: dict[str, dict] = {}

    def add(self, well_id: str, data: dict) -> None:
        self._store[well_id] = data
        logger.debug("stored well_id=%s", well_id)

    def get(self, well_id: str) -> Optional[dict]:
        return self._store.get(well_id)

    def exists(self, well_id: str) -> bool:
        return well_id in self._store

    def size(self) -> int:
        return len(self._store)

    def clear(self) -> None:
        """Полезно в тестах — сбросить состояние между прогонами."""
        self._store.clear()


# Singleton — один экземпляр на всё приложение
well_repository = WellRepository()