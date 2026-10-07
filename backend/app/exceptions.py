class PetroVizError(Exception):
    status_code = 500
    detail = "Internal error"

    def __init__(self, message: str | None = None):
        # Если передали сообщение — используем его; иначе остаётся классовый default
        if message:
            self.detail = message
        super().__init__(self.detail)


class InvalidFileError(PetroVizError):
    status_code = 400
    detail = "Invalid file"


class FileTooLargeError(PetroVizError):
    status_code = 413
    detail = "File too large"


class LasParseError(PetroVizError):
    status_code = 400
    detail = "Failed to parse LAS file"


class WellNotFoundError(PetroVizError):
    status_code = 404
    detail = "Well not found"


class CurveNotFoundError(PetroVizError):
    status_code = 400
    detail = "Requested curve not found"


class InvalidParameterError(PetroVizError):
    status_code = 400
    detail = "Invalid parameter"