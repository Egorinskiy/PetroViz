"""
Петрофизические расчёты PetroViz.

Импорт модулей автоматически регистрирует методы в общем реестре METHODS.
"""
from .base import METHODS, get_methods_by_category

# Импорт регистрирует методы (side-effect)
from . import vshale     # noqa: F401
from . import porosity   # noqa: F401
from . import swi        # noqa: F401
from . import archie     # noqa: F401
from . import ntg        # noqa: F401
from . import permeability  # noqa: F401


__all__ = ["METHODS", "get_methods_by_category"]