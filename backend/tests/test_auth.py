"""
Тесты auth-эндпоинтов.
"""
import json


def test_register_success(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "new_user",
            "email": "new_user@example.com",
            "password": "secret123",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["username"] == "new_user"
    assert body["role"] == "viewer"
    assert body["is_active"] is True
    assert "id" in body


def test_register_duplicate_username(client):
    payload = {
        "username": "dup_user",
        "email": "dup1@example.com",
        "password": "secret123",
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    # Тот же username, другой email
    r2 = client.post(
        "/api/auth/register",
        json={**payload, "email": "dup2@example.com"},
    )
    assert r2.status_code == 409
    assert r2.json()["error"] == "UsernameTakenError"


def test_register_duplicate_email(client):
    payload = {
        "username": "user_a",
        "email": "same@example.com",
        "password": "secret123",
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = client.post(
        "/api/auth/register",
        json={**payload, "username": "user_b"},
    )
    assert r2.status_code == 409
    assert r2.json()["error"] == "EmailTakenError"


def test_register_short_password(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "short_pass",
            "email": "short@example.com",
            "password": "123",     # < 8 символов
        },
    )
    assert r.status_code == 422


def test_register_invalid_email(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "bad_email",
            "email": "not-an-email",
            "password": "secret123",
        },
    )
    assert r.status_code == 422


def test_login_success(client):
    # Создаём пользователя
    client.post(
        "/api/auth/register",
        json={
            "username": "login_user",
            "email": "login@example.com",
            "password": "secret123",
        },
    )
    # Логинимся
    r = client.post(
        "/api/auth/login",
        json={"username": "login_user", "password": "secret123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "wrong_pass",
            "email": "wrong@example.com",
            "password": "secret123",
        },
    )
    r = client.post(
        "/api/auth/login",
        json={"username": "wrong_pass", "password": "wrong"},
    )
    assert r.status_code == 401
    assert r.json()["error"] == "InvalidCredentialsError"


def test_login_nonexistent_user(client):
    r = client.post(
        "/api/auth/login",
        json={"username": "ghost", "password": "anything"},
    )
    assert r.status_code == 401
    assert r.json()["error"] == "InvalidCredentialsError"


def test_me_with_token(client):
    # Регистрация + логин
    client.post(
        "/api/auth/register",
        json={
            "username": "me_user",
            "email": "me@example.com",
            "password": "secret123",
        },
    )
    r = client.post(
        "/api/auth/login",
        json={"username": "me_user", "password": "secret123"},
    )
    token = r.json()["access_token"]

    # /me
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "me_user"


def test_me_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_invalid_token(client):
    r = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer garbage.token.here"},
    )
    assert r.status_code == 401


def test_refresh_token(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "refresh_user",
            "email": "refresh@example.com",
            "password": "secret123",
        },
    )
    r = client.post(
        "/api/auth/login",
        json={"username": "refresh_user", "password": "secret123"},
    )
    refresh = r.json()["refresh_token"]

    # Обновляем
    r = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert "refresh_token" in body


def test_refresh_with_access_token_fails(client):
    """Access-токен НЕ должен работать для refresh."""
    client.post(
        "/api/auth/register",
        json={
            "username": "wrong_type",
            "email": "wt@example.com",
            "password": "secret123",
        },
    )
    r = client.post(
        "/api/auth/login",
        json={"username": "wrong_type", "password": "secret123"},
    )
    access = r.json()["access_token"]

    r = client.post("/api/auth/refresh", json={"refresh_token": access})
    assert r.status_code == 401
