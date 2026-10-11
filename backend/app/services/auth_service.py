"""
Логика аутентификации: регистрация, вход, обновление last_login.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.jwt import create_access_token, create_refresh_token
from ..auth.password import verify_password
from ..db.models import User
from ..exceptions import PetroVizError
from ..repositories.user_repository import UserRepository

logger = logging.getLogger("petroviz.auth.service")


class UsernameTakenError(PetroVizError):
    status_code = 409
    detail = "Username already taken"


class EmailTakenError(PetroVizError):
    status_code = 409
    detail = "Email already registered"


class InvalidCredentialsError(PetroVizError):
    status_code = 401
    detail = "Invalid username or password"


class InactiveUserError(PetroVizError):
    status_code = 403
    detail = "User account is disabled"


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = UserRepository(session)

    async def register(
        self,
        username: str,
        email: str,
        password: str,
        full_name: str | None = None,
    ) -> User:
        """Регистрация нового пользователя. По умолчанию — роль VIEWER."""
        # Проверка уникальности
        if await self.repo.exists_username(username):
            raise UsernameTakenError(f"Username '{username}' is already taken")

        if await self.repo.exists_email(email):
            raise EmailTakenError(f"Email '{email}' is already registered")

        user = await self.repo.create(
            username=username,
            email=email,
            password=password,
            full_name=full_name,
            # role по умолчанию VIEWER
        )
        logger.info("Registered new user: %s", username)
        return user

    async def authenticate(self, username: str, password: str) -> User:
        """Проверяет логин/пароль. Возвращает User или кидает InvalidCredentials."""
        user = await self.repo.get_by_username(username)

        # Защита от timing-атак: даже если юзера нет, делаем фиктивную проверку.
        # Но для диплома можно упростить — просто InvalidCredentials.
        if user is None:
            # Всё равно хешируем "пустой" пароль, чтобы время ответа было похожим
            from ..auth.password import hash_password
            hash_password("dummy")
            raise InvalidCredentialsError()

        if not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()

        if not user.is_active:
            raise InactiveUserError()

        # Обновляем last_login
        user.last_login = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)

        logger.info("User authenticated: %s", username)
        return user

    def issue_tokens(self, user: User) -> tuple[str, str]:
        """Возвращает (access_token, refresh_token)."""
        return create_access_token(user.id), create_refresh_token(user.id)