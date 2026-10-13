"""
Конфигурация PetroViz через pydantic-settings.

Все настройки читаются из:
  1. Переменных окружения (приоритет 1).
  2. Файла .env (приоритет 2).
  3. Значений по умолчанию (приоритет 3).

Префикс всех переменных: PETROVIZ_
"""
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent  # .../backend


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_prefix="PETROVIZ_",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "PetroViz API"
    app_version: str = "0.3.0"
    debug: bool = True
    log_level: str = "INFO"

    # --- Server ---
    host: str = "127.0.0.1"
    port: int = 8000

    # --- CORS ---
    # Храним как строку через запятую. Парсинг — в свойстве allowed_origins_list.
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- Database ---
    database_url: str = (
        "postgresql+asyncpg://petroviz:petroviz_dev_password@localhost:5432/petroviz"
    )
    test_database_url: str = (
        "postgresql+asyncpg://petroviz:petroviz_dev_password@localhost:5432/petroviz_test"
    )

    # --- Auth ---
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # --- Bootstrap admin ---
    admin_username: str = "admin"
    admin_email: str = "admin@petroviz.local"
    admin_password: str | None = None    # если None — admin не создаётся

    # --- File limits ---
    max_file_size_bytes: int = 50 * 1024 * 1024
    max_points_default: int = 5000
    max_points_hard_limit: int = 100_000

    # --- Adaptive downsample ---
    adaptive_points_per_meter: int = 10
    adaptive_min_points: int = 500
    adaptive_max_points: int = 20_000

    # --- Pixel downsample ---
    pixel_oversample: float = 2.0
    pixel_min_width: int = 100
    pixel_max_width: int = 4000

    # --- Storage ---
    well_data_dir: str = "storage/wells"
    computation_data_dir: str = "storage/computations"

    # --- Derived (не из .env, а вычисляемые) ---
    @property
    def base_dir(self) -> Path:
        return BASE_DIR

    @property
    def log_dir(self) -> Path:
        return BASE_DIR / "logs"

    @property
    def sample_data_dir(self) -> Path:
        return BASE_DIR / "sample_data"

    @property
    def well_data_path(self) -> Path:
        """Абсолютный путь к папке с parquet-файлами."""
        p = Path(self.well_data_dir)
        if not p.is_absolute():
            p = BASE_DIR / p
        return p

    @property
    def computation_data_path(self) -> Path:
        p = Path(self.computation_data_dir)
        if not p.is_absolute():
            p = BASE_DIR / p
        return p

    @property
    def allowed_extensions(self) -> set[str]:
        return {".las"}

    @property
    def allowed_origins_list(self) -> list[str]:
        """Список CORS-доменов, распарсенный из строки через запятую."""
        return [s.strip() for s in self.allowed_origins.split(",") if s.strip()]

    # --- Валидаторы ---
    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        v_upper = v.upper()
        if v_upper not in allowed:
            raise ValueError(f"log_level must be one of {allowed}")
        return v_upper


# Singleton — читается один раз при импорте
settings = Settings()