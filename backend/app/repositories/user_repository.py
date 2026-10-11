"""
Repository для пользователей.
"""
import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, UserRole
from ..auth.password import hash_password

logger = logging.getLogger("petroviz.repo.users")


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        stmt = select(User).where(User.username == username)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def exists_username(self, username: str) -> bool:
        return await self.get_by_username(username) is not None

    async def exists_email(self, email: str) -> bool:
        return await self.get_by_email(email) is not None

    async def count(self) -> int:
        """Сколько всего пользователей (для bootstrap первого админа)."""
        from sqlalchemy import func
        stmt = select(func.count()).select_from(User)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def create(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str | None = None,
        role: UserRole = UserRole.VIEWER,
        is_active: bool = True,
    ) -> User:
        """
        Создаёт пользователя. Пароль передаётся в открытом виде — хешируется здесь.
        """
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=role,
            is_active=is_active,
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        logger.info("Created user %s (%s)", username, role.value)
        return user

    async def list_all(self, limit: int = 100, offset: int = 0) -> list[User]:
        stmt = (
            select(User)
            .order_by(User.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, user: User) -> None:
        await self.session.delete(user)
        await self.session.commit()
        logger.info("Deleted user %s", user.username)