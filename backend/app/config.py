from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Общие лимиты ---
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
MAX_POINTS_HARD_LIMIT = 100_000       # потолок для любого режима

# --- Режим "fixed" ---
MAX_POINTS_DEFAULT = 5000             # если клиент не указал max_points

# --- Режим "adaptive" ---
ADAPTIVE_POINTS_PER_METER = 10        # 10 точек на метр глубины
ADAPTIVE_MIN_POINTS = 500             # не меньше
ADAPTIVE_MAX_POINTS = 20_000          # не больше (ниже HARD_LIMIT)

# --- Режим "pixel" ---
PIXEL_OVERSAMPLE = 2.0                # коэффициент запаса
PIXEL_MIN_WIDTH = 100                 # минимальная разумная ширина канваса
PIXEL_MAX_WIDTH = 4000                # выше — не признаём (это уже не график)

# --- Прочее ---
ALLOWED_EXTENSIONS = {".las"}
SAMPLE_DATA_DIR = BASE_DIR / "sample_data"
LOG_DIR = BASE_DIR / "logs"