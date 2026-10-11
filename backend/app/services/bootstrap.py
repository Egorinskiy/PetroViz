"""
Bootstrap-логика: создание первого администратора при старте на пустой БД.

Вызывается из lifespan в main.py.
"""
import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, UserRole
from ..auth.password import hash_password
from ..settings import settings

logger = logging.getLogger("petroviz.bootstrap")


async def ensure_admin_user(session: AsyncSession) -> None:
    """
    Если в БД нет ни одного пользователя и задан PETROVIZ_ADMIN_PASSWORD —
    создаёт первого admin-пользователя.
    Если пользователи есть — ничего не делает.
    """
    # Проверяем, есть ли хоть один пользователь
    stmt = select(func.count()).select_from(User)
    result = await session.execute(stmt)
    user_count = result.scalar_one()

    if user_count > 0:
        logger.info("Users exist (%d) — skip admin bootstrap", user_count)
        return

    # Нет пользователей — пытаемся создать admin
    if not settings.admin_password:
        logger.warning(
            "No users in DB and PETROVIZ_ADMIN_PASSWORD is not set. "
            "Admin will NOT be created. Set the password in .env and restart."
        )
        return

    admin = User(
        username=settings.admin_username,
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_password),
        full_name="Administrator",
        role=UserRole.ADMIN,
        is_active=True,
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)

    logger.warning(
        "Created bootstrap admin: %s (id=%s). "
        "CHANGE THE PASSWORD AFTER FIRST LOGIN!",
        admin.username, admin.id,
    )