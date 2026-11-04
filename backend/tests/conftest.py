"""
Общие фикстуры для тестов PetroViz.

ВАЖНО:
  * тесты работают с ОТДЕЛЬНОЙ БД (petroviz_test);
  * TestClient (anyio) и pytest-asyncio используют разные event loop —
    async engine не трогаем в pytest-loop, только внутри HTTP-запроса.
"""
import asyncio

import bcrypt
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db import models  # noqa: F401
from app.db.session import get_session
from app.main import app
from app.settings import settings

_original_gensalt = bcrypt.gensalt


def _fast_gensalt(rounds=4, prefix=b"2b"):
    return _original_gensalt(rounds=4, prefix=prefix)


bcrypt.gensalt = _fast_gensalt

_loop_engines: dict[int, object] = {}


def _sync_db_url() -> str:
    return settings.test_database_url.replace("postgresql+asyncpg", "postgresql+psycopg2")


def _run_async(coro):
    return asyncio.run(coro)


@pytest.fixture(scope="session")
def _prepare_test_db():
    async def _ddl() -> None:
        engine = create_async_engine(
            settings.test_database_url,
            echo=False,
            poolclass=NullPool,
        )
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    _run_async(_ddl())
    yield


@pytest.fixture(autouse=True)
def clean_tables(_prepare_test_db):
    """TRUNCATE через sync-драйвер — без asyncio loop pytest."""
    engine = create_engine(_sync_db_url(), poolclass=NullPool)
    with engine.begin() as conn:
        conn.execute(
            text("TRUNCATE well_access, audit_log, wells, users CASCADE")
        )
    engine.dispose()


@pytest.fixture
def client(_prepare_test_db):
    async def _override_get_session():
        loop = asyncio.get_running_loop()
        key = id(loop)
        if key not in _loop_engines:
            _loop_engines[key] = create_async_engine(
                settings.test_database_url,
                echo=False,
                poolclass=NullPool,
            )
        eng = _loop_engines[key]
        async with AsyncSession(eng) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    with TestClient(app, lifespan="off") as c:
        yield c
    app.dependency_overrides.clear()


async def _create_user(session, username: str, email: str, password: str, role):
    from app.repositories.user_repository import UserRepository

    repo = UserRepository(session)
    return await repo.create(
        username=username,
        email=email,
        password=password,
        role=role,
    )


def _seed_user(username: str, email: str, password: str, role):
    async def _go():
        engine = create_async_engine(
            settings.test_database_url,
            poolclass=NullPool,
        )
        async with AsyncSession(engine) as session:
            await _create_user(session, username, email, password, role)
        await engine.dispose()

    _run_async(_go())


@pytest.fixture
def default_user(_prepare_test_db):
    from app.db.models import UserRole

    _seed_user(
        "test_viewer",
        "viewer@example.com",
        "viewer_pass_123",
        UserRole.VIEWER,
    )


@pytest.fixture
def admin_user(_prepare_test_db):
    from app.db.models import UserRole

    _seed_user(
        "test_admin",
        "admin@example.com",
        "admin_pass_123",
        UserRole.ADMIN,
    )


@pytest.fixture
def auth_headers(client, default_user):
    r = client.post(
        "/api/auth/login",
        json={"username": "test_viewer", "password": "viewer_pass_123"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(client, admin_user):
    r = client.post(
        "/api/auth/login",
        json={"username": "test_admin", "password": "admin_pass_123"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client(client, auth_headers):
    class AuthedClient:
        def __init__(self, client, headers):
            self._client = client
            self._headers = headers

        def _merge(self, kwargs):
            h = kwargs.pop("headers", {})
            return {**self._headers, **h}

        def get(self, url, **kwargs):
            return self._client.get(url, headers=self._merge(kwargs), **kwargs)

        def post(self, url, **kwargs):
            return self._client.post(url, headers=self._merge(kwargs), **kwargs)

        def delete(self, url, **kwargs):
            return self._client.delete(url, headers=self._merge(kwargs), **kwargs)

        def patch(self, url, **kwargs):
            return self._client.patch(url, headers=self._merge(kwargs), **kwargs)

    return AuthedClient(client, auth_headers)


@pytest.fixture
def admin_client(client, admin_headers):
    class AuthedClient:
        def __init__(self, client, headers):
            self._client = client
            self._headers = headers

        def _merge(self, kwargs):
            h = kwargs.pop("headers", {})
            return {**self._headers, **h}

        def get(self, url, **kwargs):
            return self._client.get(url, headers=self._merge(kwargs), **kwargs)

        def post(self, url, **kwargs):
            return self._client.post(url, headers=self._merge(kwargs), **kwargs)

        def delete(self, url, **kwargs):
            return self._client.delete(url, headers=self._merge(kwargs), **kwargs)

        def patch(self, url, **kwargs):
            return self._client.patch(url, headers=self._merge(kwargs), **kwargs)

    return AuthedClient(client, admin_headers)
