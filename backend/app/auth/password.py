"""
Хеширование и проверка паролей через bcrypt напрямую.

Passlib не используется — библиотека заброшена (последний релиз 2020),
а bcrypt 4.1+ самодостаточен.
"""
import bcrypt


# bcrypt требует пароль ≤ 72 байта. Обрезаем безопасно.
_BCRYPT_MAX_BYTES = 72
_BCRYPT_ROUNDS = 12


def hash_password(plain: str) -> str:
    """Хеширует пароль для хранения в БД."""
    pwd_bytes = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Проверяет соответствие пароля хешу."""
    try:
        pwd_bytes = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        hash_bytes = hashed.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False