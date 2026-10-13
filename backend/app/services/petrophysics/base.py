"""
Реестр петрофизических методов и общие утилиты.

Каждый метод описывается словарём:
    key         — уникальный идентификатор (snake_case)
    label       — человекочитаемое имя для UI
    category    — "vshale" | "porosity" | "swi" | "sw" | "perm"
    requires    — список ролей входных кривых: ["gr"], ["rhob", "nphi"]
    params      — словарь параметров {name: {default, min, max, step, unit, description}}
    output      — имя выходной кривой по умолчанию
"""
import logging

logger = logging.getLogger("petroviz.petrophysics")


# Глобальный реестр. Заполняется через register() при импорте модулей.
METHODS: dict = {}


def register_method(spec: dict) -> None:
    """Регистрирует метод в глобальном реестре."""
    key = spec["key"]
    if key in METHODS:
        logger.warning("Method '%s' already registered, overwriting", key)
    METHODS[key] = spec
    logger.debug("Registered method: %s (%s)", key, spec.get("label"))


def get_methods_by_category(category: str) -> list[dict]:
    return [m for m in METHODS.values() if m["category"] == category]