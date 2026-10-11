"""
Создание и проверка JWT-токенов.

Два типа токенов:
  * access  — короткоживущий (30 мин), в каждом API-запросе.
  * refresh — долгоживущий (7 дней), только для обновления access.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from jose import JWTError, jwt

from ..exceptions import PetroVizError
from ..settings import settings

logger = logging.getLogger("petroviz.auth.jwt")


TokenType = Literal["access", "refresh"]


class InvalidTokenError(PetroVizError):
    status_code = 401
    detail = "Invalid or expired token"


def _create_token(
    user_id: uuid.UUID,
    token_type: TokenType,
    expires_delta: timedelta,
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),       # subject — ID пользователя
        "type": token_type,        # access или refresh
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": str(uuid.uuid4()),  # уникальный ID токена (для возможного blacklist)
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: uuid.UUID) -> str:
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: TokenType | None = None) -> dict:
    """
    Декодирует и валидирует токен.

    :raises InvalidTokenError: если токен просрочен, подпись неверна,
                                или тип не совпадает с expected_type.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as e:
        logger.warning("JWT decode failed: %s", e)
        raise InvalidTokenError(f"Token decode failed: {e}")

    if expected_type is not None and payload.get("type") != expected_type:
        raise InvalidTokenError(
            f"Expected '{expected_type}' token, got '{payload.get('type')}'"
        )

    return payload