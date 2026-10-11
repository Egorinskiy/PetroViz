"""
Admin-логика: управление пользователями.
"""
import logging
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, UserRole
from ..exceptions import PetroVizError
from ..repositories.user_repository import UserRepository

logger = logging.getLogger("petroviz.admin.users")


class UserNotFoundError(PetroVizError):
    status_code = 404
    detail = "User not found"


class SelfModificationError(PetroVizError):
    status_code = 400
    detail = "Cannot modify your own admin account"


class LastAdminError(PetroVizError):
    status_code = 400
    detail = "Cannot remove the last admin"


class AdminUserService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = UserRepository(session)

    async def list_users(
        self,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[User], int]:
        """Список пользователей + общее количество (для пагинации)."""
        stmt = select(User)
        count_stmt = select(func.count()).select_from(User)

        if search:
            pattern = f"%{search.lower()}%"
            filt = or_(
                func.lower(User.username).like(pattern),
                func.lower(User.email).like(pattern),
                func.lower(func.coalesce(User.full_name, "")).like(pattern),
            )
            stmt = stmt.where(filt)
            count_stmt = count_stmt.where(filt)

        stmt = stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)

        result = await self.session.execute(stmt)
        users = list(result.scalars().all())

        count_result = await self.session.execute(count_stmt)
        total = int(count_result.scalar_one())

        return users, total

    async def get_user(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError(f"User '{user_id}' not found")
        return user

    async def update_user(
        self,
        user_id: uuid.UUID,
        actor: User,
        *,
        role: UserRole | None = None,
        is_active: bool | None = None,
        full_name: str | None = None,
    ) -> User:
        """
        Обновление пользователя. Админ не может:
          - менять свою роль;
          - деактивировать себя;
          - разжаловать последнего admin.
        """
        user = await self.get_user(user_id)

        # Защита от выстрела в ногу
        if user.id == actor.id:
            if role is not None and role != user.role:
                raise SelfModificationError("Cannot change your own role")
            if is_active is not None and is_active is False:
                raise SelfModificationError("Cannot deactivate yourself")

        # Защита от снятия последнего админа
        if user.role == UserRole.ADMIN:
            if (role is not None and role != UserRole.ADMIN) or is_active is False:
                admins = await self._count_active_admins()
                if admins <= 1:
                    raise LastAdminError(
                        "Cannot demote or deactivate the last active admin"
                    )

        # Применяем изменения
        if role is not None:
            user.role = role
        if is_active is not None:
            user.is_active = is_active
        if full_name is not None:
            user.full_name = full_name

        await self.session.commit()
        await self.session.refresh(user)
        logger.info(
            "Admin %s updated user %s (role=%s, active=%s)",
            actor.username, user.username, user.role.value, user.is_active,
        )
        return user

    async def delete_user(self, user_id: uuid.UUID, actor: User) -> None:
        """
        Удаление пользователя. Админ не может удалить:
          - себя;
          - последнего admin.
        """
        user = await self.get_user(user_id)

        if user.id == actor.id:
            raise SelfModificationError("Cannot delete yourself")

        if user.role == UserRole.ADMIN:
            admins = await self._count_active_admins()
            if admins <= 1:
                raise LastAdminError("Cannot delete the last active admin")

        await self.session.delete(user)
        await self.session.commit()
        logger.info("Admin %s deleted user %s", actor.username, user.username)

    async def _count_active_admins(self) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .where(User.role == UserRole.ADMIN, User.is_active.is_(True))
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())