# PetroViz — Backend API

REST API для веб-платформы **PetroViz** — визуализации и базовой
интерпретации данных каротажа скважин (well logs) в формате LAS.

> Дипломный проект в Академии-Топ студента Васютинского Е.В. Backend предоставляет парсинг LAS-файлов, метаданные
> скважин, кривые с фильтрацией по глубине и гибкими стратегиями прореживания.

---

## Стек

- **Python 3.14**
- **FastAPI** — веб-фреймворк
- **Uvicorn** — ASGI-сервер
- **lasio** — парсинг LAS-файлов
- **pandas / numpy** — работа с табличными данными
- **pytest** — тестирование

---

## Установка

```powershell
# Клонировать репозиторий и перейти в backend/
cd backend

# Создать виртуальное окружение
python -m venv venv

# Активировать (Windows PowerShell)
venv\Scripts\Activate.ps1

# (Linux/macOS)
source venv/bin/activate

# Установить зависимости
pip install -r requirements.txt