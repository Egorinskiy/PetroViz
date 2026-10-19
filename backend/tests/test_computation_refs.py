"""
Integration-тесты для computation_refs (Sw/Swi/R0).

Проверяют валидацию в ComputationService._load_computation_refs:
- отсутствие обязательного ref → 400
- несуществующий UUID → 400
- неверная категория метода (VSH вместо PHI) → 400
- успешный расчёт с корректными refs → 200 + sources в ответе
- сохранение Swi с refs → source_refs пишется в БД
"""
import json
import uuid
from pathlib import Path

import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_LAS = BASE_DIR / "sample_data" / "sample.las"


# ============================================================================
# Helpers
# ============================================================================

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


def _available_curves(client, well_id: str) -> list[str]:
    r = client.get(f"/api/wells/{well_id}")
    assert r.status_code == 200, r.text
    return [c["mnemonic"] for c in r.json()["curves"]]


def _find_method_for(curves: list[str], category: str) -> str | None:
    """Возвращает подходящий метод для категории, если нужные кривые есть."""
    upper = {c.upper() for c in curves}
    if category == "vshale":
        if upper & {"GR", "GAM", "GAPI", "SGR", "HSGR", "GK"}:
            return "vshale_linear"
        return None
    if category == "porosity":
        if upper & {"RHOB", "RHOZ", "ROBB", "DEN", "ZDEN"}:
            return "porosity_density"
        if upper & {"NPHI", "CNL", "TNPH", "NNK"}:
            return "porosity_neutron"
        if upper & {"DTC", "DT", "AC", "SONIC"}:
            return "porosity_sonic"
        return None
    return None


def _find_rt(curves: list[str]) -> str | None:
    upper = {c.upper() for c in curves}
    for candidate in ["RDEP", "RT", "ILD", "LLD", "RES"]:
        if candidate in upper:
            return candidate
    return None


def _save_comp(client, well_id: str, method: str, mapping=None, params=None) -> str:
    """Сохраняет расчёт, возвращает его ID."""
    payload = {
        "method": method,
        "curve_mapping": mapping or {},
        "params": params or {},
    }
    r = client.post(f"/api/wells/{well_id}/computations", json=payload)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _error_text(r) -> str:
    """Возвращает объединённый текст ошибки из response JSON (lowercase)."""
    try:
        body = r.json()
    except Exception:
        return r.text.lower()
    return json.dumps(body, ensure_ascii=False).lower()


# ============================================================================
# Ошибки — ref обязателен
# ============================================================================

def test_sw_archie_without_refs(auth_client):
    """sw_archie без computation_refs → 400."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    rt = _find_rt(curves)
    if rt is None:
        pytest.skip("Sample LAS has no resistivity curve")

    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": rt},
        "params": {},
    })
    assert r.status_code == 400, r.text
    text = _error_text(r)
    assert "requires saved computations" in text or "computation_refs" in text


def test_sw_archie_with_nonexistent_ref(auth_client):
    """sw_archie с несуществующим UUID → 400."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    rt = _find_rt(curves)
    if rt is None:
        pytest.skip("Sample LAS has no resistivity curve")

    fake_id = str(uuid.uuid4())
    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": rt},
        "computation_refs": {"phi": fake_id},
    })
    assert r.status_code == 400, r.text
    assert "not found" in _error_text(r)


def test_sw_archie_with_wrong_category(auth_client):
    """VSH передан как phi → 400 про категорию."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    rt = _find_rt(curves)
    if rt is None:
        pytest.skip("Sample LAS has no resistivity curve")
    vsh_method = _find_method_for(curves, "vshale")
    if vsh_method is None:
        pytest.skip("Sample LAS has no GR curve")

    vsh_id = _save_comp(auth_client, well_id, vsh_method)
    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": rt},
        "computation_refs": {"phi": vsh_id},
    })
    assert r.status_code == 400, r.text
    assert "category" in _error_text(r)


# ============================================================================
# Успешные расчёты
# ============================================================================

def test_sw_archie_success(auth_client):
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    rt = _find_rt(curves)
    if rt is None:
        pytest.skip("Sample LAS has no resistivity curve")
    phi_method = _find_method_for(curves, "porosity")
    if phi_method is None:
        pytest.skip("Sample LAS has no porosity curves")

    phi_id = _save_comp(auth_client, well_id, phi_method)
    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": rt},
        "params": {"a": 1.0, "m": 2.0, "n": 2.0, "rw": 0.1},
        "computation_refs": {"phi": phi_id},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "SW" in body["curves"]
    assert body["sources"] == {"phi": phi_id}
    assert len(body["curves"]["SW"]["values"]) == len(body["depth"])


def test_swi_bound_water_success(auth_client):
    """Swi требует 2 ref — VSH и PHI."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    vsh_method = _find_method_for(curves, "vshale")
    phi_method = _find_method_for(curves, "porosity")
    if vsh_method is None or phi_method is None:
        pytest.skip("Sample LAS has no GR or porosity curves")

    vsh_id = _save_comp(auth_client, well_id, vsh_method)
    phi_id = _save_comp(auth_client, well_id, phi_method)

    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "swi_bound_water",
        "params": {"c1": 0.015, "c2": 0.2},
        "computation_refs": {"vsh": vsh_id, "phi": phi_id},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "SWI" in body["curves"]
    assert body["sources"] == {"vsh": vsh_id, "phi": phi_id}


def test_r0_archie_success(auth_client):
    """R0 требует только PHI."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    phi_method = _find_method_for(curves, "porosity")
    if phi_method is None:
        pytest.skip("Sample LAS has no porosity curves")

    phi_id = _save_comp(auth_client, well_id, phi_method)
    r = auth_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "r0_archie",
        "params": {"a": 1.0, "m": 2.0, "rw": 0.1},
        "computation_refs": {"phi": phi_id},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "R0" in body["curves"]
    assert body["sources"] == {"phi": phi_id}


# ============================================================================
# Сохранение Swi → source_refs в БД
# ============================================================================

def test_save_swi_persists_sources(auth_client):
    """Сохранение Swi → source_refs сохраняются и возвращаются при list."""
    well_id = _upload_sample_las(auth_client)
    curves = _available_curves(auth_client, well_id)
    vsh_method = _find_method_for(curves, "vshale")
    phi_method = _find_method_for(curves, "porosity")
    if vsh_method is None or phi_method is None:
        pytest.skip("Sample LAS has no GR or porosity curves")

    vsh_id = _save_comp(auth_client, well_id, vsh_method)
    phi_id = _save_comp(auth_client, well_id, phi_method)

    # Сохраняем Swi с refs
    r = auth_client.post(f"/api/wells/{well_id}/computations", json={
        "method": "swi_bound_water",
        "params": {"c1": 0.015, "c2": 0.2},
        "computation_refs": {"vsh": vsh_id, "phi": phi_id},
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["source_refs"] == {"vsh": vsh_id, "phi": phi_id}

    # Проверяем, что при list source_refs тоже приходят
    r2 = auth_client.get(f"/api/wells/{well_id}/computations")
    assert r2.status_code == 200
    items = r2.json()["items"]
    swi_item = next(i for i in items if i["method"] == "swi_bound_water")
    assert swi_item["source_refs"] == {"vsh": vsh_id, "phi": phi_id}