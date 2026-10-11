import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_LAS = BASE_DIR / "sample_data" / "sample.las"


def _upload_sample_las(client) -> str:
    """Загружает sample.las, возвращает well_id."""
    assert SAMPLE_LAS.exists(), f"Нет файла: {SAMPLE_LAS}"
    with SAMPLE_LAS.open("rb") as f:
        r = client.post(
            "/api/wells/upload",
            files={"file": ("sample.las", f, "application/octet-stream")},
        )
    assert r.status_code == 200, r.text
    return r.json()["well_id"]


# --- День 6: базовые тесты ---

def test_upload_las(client):
    well_id = _upload_sample_las(client)
    assert isinstance(well_id, str) and well_id


def test_get_well_info(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}")
    assert r.status_code == 200
    body = r.json()
    assert "curves" in body
    assert "start_depth" in body
    assert "stop_depth" in body


def test_get_well_data(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?max_points=100")
    assert r.status_code == 200
    body = r.json()
    assert "depth" in body
    assert isinstance(body["depth"], list)
    assert len(body["depth"]) <= 100


# --- Валидация ---

def test_upload_wrong_extension(client):
    r = client.post(
        "/api/wells/upload",
        files={"file": ("data.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"] == "InvalidFileError"
    assert "Unsupported extension" in body["detail"]


def test_upload_empty_file(client):
    r = client.post(
        "/api/wells/upload",
        files={"file": ("empty.las", b"", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "empty" in r.json()["detail"].lower()


def test_upload_garbage_file(client):
    r = client.post(
        "/api/wells/upload",
        files={"file": ("garbage.las", b"not a las", "text/plain")},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidFileError"


def test_well_not_found(client):
    r = client.get("/api/wells/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
    assert r.json()["error"] == "WellNotFoundError"


def test_curve_not_found(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?curves=DOESNOTEXIST")
    assert r.status_code == 400
    assert r.json()["error"] == "CurveNotFoundError"


def test_nan_serialization(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?max_points=100")
    assert r.status_code == 200
    assert "NaN" not in r.text
    assert "Infinity" not in r.text
    json.loads(r.text)


def test_max_points_hard_limit(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?max_points=99999999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


# --- Режимы прореживания ---

def test_mode_fixed_default(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 5000


def test_mode_fixed_explicit(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=fixed&max_points=200")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 200


def test_mode_fixed_exceeds_hard_limit(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=fixed&max_points=99999999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_adaptive_without_depths(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=adaptive")
    assert r.status_code == 200
    assert "depth" in r.json()


def test_mode_adaptive_with_range(client):
    well_id = _upload_sample_las(client)
    r = client.get(
        f"/api/wells/{well_id}/data?mode=adaptive&start_depth=100&stop_depth=200"
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["depth"]) <= 2000


def test_mode_pixel_without_width(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_pixel_with_width(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=800")
    assert r.status_code == 200
    assert len(r.json()["depth"]) <= 1600


def test_mode_invalid(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=garbage")
    assert r.status_code == 422


def test_mode_pixel_width_too_small(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=10")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"


def test_mode_pixel_width_too_large(client):
    well_id = _upload_sample_las(client)
    r = client.get(f"/api/wells/{well_id}/data?mode=pixel&pixel_width=99999")
    assert r.status_code == 400
    assert r.json()["error"] == "InvalidParameterError"