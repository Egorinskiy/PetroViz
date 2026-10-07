from pathlib import PurePosixPath
from ..config import MAX_FILE_SIZE_BYTES, ALLOWED_EXTENSIONS
from ..exceptions import InvalidFileError, FileTooLargeError


def validate_las_upload(filename: str | None, content: bytes) -> None:
    if not filename:
        raise InvalidFileError("Filename is missing")

    ext = PurePosixPath(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidFileError(
            f"Unsupported extension '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}"
        )

    if len(content) == 0:
        raise InvalidFileError("File is empty")

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(
            f"File size {len(content)} exceeds limit {MAX_FILE_SIZE_BYTES}"
        )

    if not _looks_like_las(content):
        raise InvalidFileError(
            "File does not look like a LAS file "
            "(no '~' section header found in first lines)"
        )


def _looks_like_las(content: bytes, max_bytes: int = 8192) -> bool:
    """
    True, если в первых N байт есть строка-заголовок секции LAS (~Version, ~Well, ~Curve, ~ASCII, ~A).

    Игнорирует:
      * пустые строки;
      * строки-комментарии, начинающиеся с '#'.

    Всё остальное до заголовка — мусор → отказ.
    """
    head = content[:max_bytes].decode("utf-8", errors="ignore")
    for line in head.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            continue
        return stripped.startswith("~")
    return False