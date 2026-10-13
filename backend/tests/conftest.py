"""
Общие фикстуры для тестов PetroViz.

ВАЖНО:
  * тесты работают с ОТДЕЛЬНОЙ БД (petroviz_test),
    dev-данные не трогаются;
  * engine создаётся заново на каждый event loop — иначе asyncpg
    теряет соединения между тестами на Windows.
"""
import asyncio
import uuid
import bcrypt
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from fastapi.testclient import TestClient

from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import get_session
from app.main import app
from app.repositories.well_repository import ensure_system_user
from app.settings import settings

# ============================================================================
# bcrypt: ускоряем хеширование в 250 раз (12 → 4 rounds)
# ============================================================================
# В продакшене 12 rounds (~250 мс) — правильно, защищает от брутфорса.
# В тестах скорость важнее: 4 rounds (~1 мс), при этом bcrypt API не меняется.
_original_gensalt = bcrypt.gensalt
def _fast_gensalt(rounds=4, prefix=b"2b"):
    return _original_gensalt(rounds=4, prefix=prefix)
bcrypt.gensalt = _fast_gensalt


# --- Тестовый engine с NullPool (без переиспользования соединений) ---

@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def _test_engine_session():
    """Один engine на всю сессию. DDL один раз."""
    engine = create_async_engine(
        settings.test_database_url,
        echo=False,
        poolclass=NullPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(loop_scope="function")
async def test_engine(_test_engine_session):
    """Function-scoped обёртка: тот же engine, без DDL."""
    yield _test_engine_session


@pytest_asyncio.fixture
async def test_session_factory(test_engine):
    return async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


@pytest.fixture(autouse=True)
async def clean_tables(test_engine):
    """Очищаем таблицы перед каждым тестом."""
    async with test_engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE well_access, audit_log, wells, users CASCADE")
        )


@pytest.fixture
def client(test_engine):
    """
    HTTP-клиент FastAPI с переопределённой зависимостью get_session →
    тестовая БД.
    """
    async def _override_get_session():
        async with AsyncSession(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ============================================================================
# Auth-фикстуры
# ============================================================================

async def _create_user(session, username: str, email: str, password: str, role):
    """Создаёт пользователя в тестовой БД через репозиторий."""
    from app.repositories.user_repository import UserRepository
    repo = UserRepository(session)
    return await repo.create(
        username=username,
        email=email,
        password=password,
        role=role,
    )


@pytest.fixture
async def default_user(test_engine):
    """Обычный viewer-пользователь."""
    from app.db.models import UserRole
    async with AsyncSession(test_engine) as session:
        user = await _create_user(
            session,
            username="test_viewer",
            email="viewer@example.com",
            password="viewer_pass_123",
            role=UserRole.VIEWER,
        )
        return user


@pytest.fixture
async def admin_user(test_engine):
    """Admin-пользователь."""
    from app.db.models import UserRole
    async with AsyncSession(test_engine) as session:
        user = await _create_user(
            session,
            username="test_admin",
            email="admin@example.com",
            password="admin_pass_123",
            role=UserRole.ADMIN,
        )
        return user


@pytest.fixture
def auth_headers(client, default_user):
    """Headers с Bearer-токеном viewer-пользователя."""
    r = client.post(
        "/api/auth/login",
        json={"username": "test_viewer", "password": "viewer_pass_123"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client, admin_user):
    """Headers с Bearer-токеном admin-пользователя."""
    r = client.post(
        "/api/auth/login",
        json={"username": "test_admin", "password": "admin_pass_123"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client(client, auth_headers):
    """
    TestClient с предустановленными auth-заголовками.
    Используем через `client.get(url, headers=auth_headers)`.
    Но удобнее — обёртка, чтобы не передавать headers каждый раз.
    """
    # Возвращаем маленький объект с методами get/post/delete,
    # которые автоматически добавляют Authorization.
    class AuthedClient:
        def __init__(self, client, headers):
            self._client = client
            self._headers = headers

        def _merge(self, kwargs):
            h = kwargs.pop("headers", {})
            merged = {**self._headers, **h}
            return merged

        def get(self, url, **kwargs):
            return self._client.get(url, headers=self._merge(kwargs), **kwargs)

        def post(self, url, **kwargs):
            return self._client.post(url, headers=self._merge(kwargs), **kwargs)

        def delete(self, url, **kwargs):
            return self._client.delete(url, headers=self._merge(kwargs), **kwargs)

        def patch(self, url, **kwargs):
            return self._client.patch(url, headers=self._merge(kwargs), **kwargs)

    return AuthedClient(client, auth_headers)
