import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import well_repository

@pytest.fixture(autouse=True)
def _reset_repository():
    """Чистим хранилище перед каждым тестом."""
    well_repository.clear()
    yield
    well_repository.clear()

# --- Настройка -------------------------------------------------------------

client = TestClient(app)

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_LAS = BASE_DIR / "sample_data" / "real_well.las"


# --- Хелперы (не тесты!) ---------------------------------------------------

def _upload_sample_las() -> str:
    """Загружает sample.las и возвращает well_id. Используется в других тестах."""
    assert SAMPLE_LAS.exists(), f"Нет файла: {SAMPLE_LAS}"
    with SAMPLE_LAS.open("rb") as f:
        r = client.post(
            "/api/wells/upload",
            files={"file": ("real_well.las", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    return r.json()["well_id"]


# --- День 6: базовые тесты -------------------------------------------------

def test_upload_las():
    well_id = _upload_sample_las()
    assert isinstance(well_id, str) and well_id


def test_get_well_info():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}")
    assert r.status_code == 200
    body = r.json()
    assert "curves" in body
    assert "start_depth" in body
    assert "stop_depth" in body


def test_get_well_data():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?max_points=100")
    assert r.status_code == 200
    body = r.json()
    assert "depth" in body
    assert isinstance(body["depth"], list)
    assert len(body["depth"]) <= 100


# --- День 7: валидация и обработка ошибок ----------------------------------

def test_upload_wrong_extension():
    r = client.post(
        "/api/wells/upload",
        files={"file": ("data.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "InvalidFileError"
    assert "Unsupported extension" in body["detail"]


def test_upload_empty_file():
    r = client.post(
        "/api/wells/upload",
        files={"file": ("empty.las", b"", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_upload_garbage_file():
    r = client.post(
        "/api/wells/upload",
        files={"file": ("garbage.las", b"not a las", "text/plain")},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidFileError"

# --- Это тесты прореживания ----------------------------------
def test_well_not_found():
    r = client.get("/api/wells/nonexistent-id")
    assert r.status_code == 404
    assert r.json()["error"] == "WellNotFoundError"


def test_curve_not_found():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?curves=DOESNOTEXIST")
    assert r.status_code == 400
    assert r.json()["error"] == "CurveNotFoundError"


def test_nan_serialization():
    """Ответ должен быть валидным JSON без NaN/Infinity."""
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?max_points=100")
    assert r.status_code == 200
    assert "NaN" not in r.text
    assert "Infinity" not in r.text
    json.loads(r.text)  # упадёт, если JSON невалиден



def test_max_points_hard_limit():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?max_points=99999999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_fixed_default():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 5000   # MAX_POINTS_DEFAULT


def test_mode_fixed_explicit():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=fixed&max_points=200")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 200


def test_mode_fixed_exceeds_hard_limit():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=fixed&max_points=99999999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_adaptive_without_depths():
    """Adaptive без start/stop использует весь диапазон df."""
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=adaptive")
    assert r.status_code == 200
    assert "depth" in r.json()


def test_mode_adaptive_with_range():
    well_id = _upload_sample_las()
    r = client.get(
        f"/api/wells/{well_id}/data?mode=adaptive"
        f"&start_depth=100&stop_depth=200"
    )
    assert r.status_code == 200
    body = r.json()
    # 100 м × 10 точек/м = 1000, но не больше, чем точек в df
    assert len(body["depth"]) <= 2000


def test_mode_pixel_without_width():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_pixel_with_width():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=800")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 1600   # 800 × 2.0


def test_mode_invalid():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=garbage")
    assert r.status_code == 422   # FastAPI сам поймает enum


def test_mode_pixel_width_too_small():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=10")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_pixel_width_too_large():
    well_id = _upload_sample_las()
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=99999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"