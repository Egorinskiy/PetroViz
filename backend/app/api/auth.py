"""
Эндпоинты аутентификации: /api/auth/*.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.dependencies import get_current_user
from ..auth.jwt import decode_token, InvalidTokenError
from ..auth.schemas import (
    LoginRequest, TokenPair, RefreshRequest,
    RegisterRequest, UserResponse,
)
from ..db.models import User
from ..db.session import get_session
from ..repositories.user_repository import UserRepository
from ..services.auth_service import AuthService


logger = logging.getLogger("petroviz.api.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    return await svc.register(
        username=data.username,
        email=data.email,
        password=data.password,
        full_name=data.full_name,
    )


@router.post("/login", response_model=TokenPair)
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    svc = AuthService(session)
    user = await svc.authenticate(data.username, data.password)
    access, refresh = svc.issue_tokens(user)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshRequest, session: AsyncSession = Depends(get_session)):
    payload = decode_token(data.refresh_token, expected_type="refresh")
    repo = UserRepository(session)
    user = await repo.get_by_id(uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise InvalidTokenError("User not found or inactive")
    svc = AuthService(session)
    access, refresh_token = svc.issue_tokens(user)
    return TokenPair(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: User = Depends(get_current_user)):
    logger.info("User %s logged out", user.username)
    return None