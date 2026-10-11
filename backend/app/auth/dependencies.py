"""
FastAPI-зависимости для аутентификации и авторизации.
"""
import uuid
import logging

from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import User, UserRole
from ..db.session import get_session
from ..repositories.user_repository import UserRepository
from .jwt import decode_token, InvalidTokenError
from ..exceptions import PetroVizError

logger = logging.getLogger("petroviz.auth.deps")


_bearer = HTTPBearer(auto_error=False)


class AuthRequiredError(PetroVizError):
    status_code = 401
    detail = "Authentication required"


class ForbiddenError(PetroVizError):
    status_code = 403
    detail = "Forbidden"


class InactiveUserAuthError(PetroVizError):
    status_code = 403
    detail = "User account is disabled"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Возвращает User из access-токена или кидает 401."""
    if credentials is None:
        raise AuthRequiredError("Missing Authorization header")

    token = credentials.credentials
    payload = decode_token(token, expected_type="access")

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise InvalidTokenError(f"Malformed token payload: {e}")

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)

    if user is None:
        raise InvalidTokenError("User not found")
    if not user.is_active:
        raise InactiveUserAuthError("User account is disabled")
    return user


def require_role(*allowed_roles: UserRole):
    """Фабрика зависимостей — проверка роли."""
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise ForbiddenError(
                f"Role '{user.role.value}' not allowed. "
                f"Required: {[r.value for r in allowed_roles]}"
            )
        return user
    return _checker