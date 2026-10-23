"""
Integration-тесты для computation_refs (Sw/Swi/R0).
"""
import json
import uuid
import numpy as np
import pytest


# ============================================================================
# Helpers
# ============================================================================

def _upload_synthetic_las(client) -> str:
    """Создает временный LAS-файл в памяти с нужными кривыми (GR, RHOB, RDEP)."""
    depth = np.linspace(1000, 1100, 101)
    gr = np.random.uniform(20, 100, 101)
    rhob = np.random.uniform(2.0, 2.6, 101)
    rdep = np.random.uniform(1, 100, 101)

    lines = [
        "~Version",
        " VERS. 2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0",
        " WRAP. NO  : ONE LINE PER DEPTH STEP",
        "~Well",
        f" STRT.M {depth[0]} :",
        f" STOP.M {depth[-1]} :",
        " STEP.M 1.0 :",
        " NULL. -999.25 :",
        "~Curve",
        " DEPT.M : DEPTH",
        " GR.GAPI : GAMMA RAY",
        " RHOB.G/C3 : DENSITY",
        " RDEP.OHMM : RESISTIVITY",
        "~ASCII"
    ]
    for i in range(len(depth)):
        lines.append(f"{depth[i]:.2f} {gr[i]:.2f} {rhob[i]:.2f} {rdep[i]:.2f}")

    las_content = "\n".join(lines).encode("utf-8")

    r = client.post(
        "/api/wells/upload",
        files={"file": ("synthetic.las", las_content, "application/octet-stream")},
    )
    assert r.status_code == 200, r.text
    return r.json()["well_id"]


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
# Ошибки — ref обязателен (используем admin_client для обхода RBAC)
# ============================================================================

def test_sw_archie_without_refs(admin_client):
    """sw_archie без computation_refs → 400."""
    well_id = _upload_synthetic_las(admin_client)

    r = admin_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": "RDEP"},
        "params": {},
    })
    assert r.status_code == 400, r.text
    text = _error_text(r)
    # Проверяем русский текст ошибки
    assert "источник" in text or "computation_refs" in text


def test_sw_archie_with_nonexistent_ref(admin_client):
    """sw_archie с несуществующим UUID → 400."""
    well_id = _upload_synthetic_las(admin_client)
    fake_id = str(uuid.uuid4())

    r = admin_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": "RDEP"},
        "computation_refs": {"phi": fake_id},
    })
    assert r.status_code == 400, r.text
    # Проверяем русский текст ошибки
    assert "не найден" in _error_text(r)


def test_sw_archie_with_wrong_category(admin_client):
    """VSH передан как phi → 400 про категорию."""
    well_id = _upload_synthetic_las(admin_client)

    # Сохраняем VSH
    vsh_id = _save_comp(
        admin_client, well_id, "vshale_linear",
        mapping={"gr": "GR"}, params={"gr_min": 15, "gr_max": 120}
    )

    # Пытаемся использовать VSH как PHI
    r = admin_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": "RDEP"},
        "computation_refs": {"phi": vsh_id},
    })
    assert r.status_code == 400, r.text
    # Проверяем русский текст ошибки (категория)
    assert "категор" in _error_text(r)


# ============================================================================
# Успешные расчёты
# ============================================================================

def test_sw_archie_success(admin_client):
    well_id = _upload_synthetic_las(admin_client)

    phi_id = _save_comp(
        admin_client, well_id, "porosity_density",
        mapping={"rhob": "RHOB"}, params={"rho_matrix": 2.65, "rho_fluid": 1.0}
    )

    r = admin_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "sw_archie",
        "curve_mapping": {"rt": "RDEP"},
        "params": {"a": 1.0, "m": 2.0, "n": 2.0, "rw": 0.1},
        "computation_refs": {"phi": phi_id},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "SW" in body["curves"]
    assert body["sources"] == {"phi": phi_id}
    assert len(body["curves"]["SW"]["values"]) == len(body["depth"])


def test_swi_bound_water_success(admin_client):
    """Swi требует 2 ref — VSH и PHI."""
    well_id = _upload_synthetic_las(admin_client)

    vsh_id = _save_comp(
        admin_client, well_id, "vshale_linear",
        mapping={"gr": "GR"}, params={"gr_min": 15, "gr_max": 120}
    )
    phi_id = _save_comp(
        admin_client, well_id, "porosity_density",
        mapping={"rhob": "RHOB"}, params={"rho_matrix": 2.65, "rho_fluid": 1.0}
    )

    r = admin_client.post("/api/computations/preview", json={
        "well_id": well_id,
        "method": "swi_bound_water",
        "params": {"c1": 0.015, "c2": 0.2},
        "computation_refs": {"vsh": vsh_id, "phi": phi_id},
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert "SWI" in body["curves"]
    assert body["sources"] == {"vsh": vsh_id, "phi": phi_id}


def test_r0_archie_success(admin_client):
    """R0 требует только PHI."""
    well_id = _upload_synthetic_las(admin_client)

    phi_id = _save_comp(
        admin_client, well_id, "porosity_density",
        mapping={"rhob": "RHOB"}, params={"rho_matrix": 2.65, "rho_fluid": 1.0}
    )

    r = admin_client.post("/api/computations/preview", json={
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

def test_save_swi_persists_sources(admin_client):
    """Сохранение Swi → source_refs сохраняются и возвращаются при list."""
    well_id = _upload_synthetic_las(admin_client)

    vsh_id = _save_comp(
        admin_client, well_id, "vshale_linear",
        mapping={"gr": "GR"}, params={"gr_min": 15, "gr_max": 120}
    )
    phi_id = _save_comp(
        admin_client, well_id, "porosity_density",
        mapping={"rhob": "RHOB"}, params={"rho_matrix": 2.65, "rho_fluid": 1.0}
    )

    # Сохраняем Swi с refs
    r = admin_client.post(f"/api/wells/{well_id}/computations", json={
        "method": "swi_bound_water",
        "params": {"c1": 0.015, "c2": 0.2},
        "computation_refs": {"vsh": vsh_id, "phi": phi_id},
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["source_refs"] == {"vsh": vsh_id, "phi": phi_id}

    # Проверяем, что при list source_refs тоже приходят
    r2 = admin_client.get(f"/api/wells/{well_id}/computations")
    assert r2.status_code == 200
    items = r2.json()["items"]
    swi_item = next(i for i in items if i["method"] == "swi_bound_water")
    assert swi_item["source_refs"] == {"vsh": vsh_id, "phi": phi_id}