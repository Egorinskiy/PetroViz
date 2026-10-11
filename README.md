# PetroViz

Веб-платформа для визуализации и базовой интерпретации данных каротажа скважин (well logs) в формате LAS.

> Дипломный проект студента Академии-Топ Васютинского Егора. Full-stack: FastAPI + React + PostgreSQL.

## Что умеет

- Загрузка LAS-файлов (версии 1.2 / 2.0) через веб-интерфейс.
- Парсинг, валидация и извлечение метаданных скважины.
- Поддержка нестандартных файлов: разные кодировки, дубликаты мнемоник, глубины под именами MD/TVD/DEPTH_M.
- Автоматическое распознавание семейств кривых (`RHOB/RHOZ/ROBB/DEN/...` → плотность, `ATxx` → УЭС и т.д.).
- Интерактивная визуализация каротажа на треках (d3.js).
  - Composite-трек RHOB + NPHI с жёлтой заливкой в зоне кроссовера.
  - Composite-трек всех УЭС с логарифмической шкалой.
  - Автоматическое распознавание семейств кривых.
  - Обрезка выбросов по перцентилям + clip по границам треков.
- Масштабы глубины: 1:200, 1:500, 1:1000, 1:2000, 1:5000, весь интервал.
- Три стратегии прореживания данных: `fixed`, `adaptive`, `pixel`.

## Стек

| Слой     | Технологии                                                       |
|----------|------------------------------------------------------------------|
| Backend  | Python 3.14, FastAPI, lasio, pandas, numpy, SQLAlchemy 2.0, Alembic, PostgreSQL, pydantic-settings, pytest |
| Frontend | React 18, Vite, d3.js, axios                                     |
| Инфра    | Docker, docker-compose                                          |

## Структура

- `backend/` — FastAPI + lasio + SQLAlchemy
- `frontend/` — React + Vite + d3
- `docker-compose.yml` — PostgreSQL для локальной разработки

Каждая папка содержит собственный README с деталями.

## Быстрый старт

### 1. PostgreSQL

```powershell
docker compose up -d postgres
```
БД будет доступна на localhost:5433 (5432 часто занят локальным PostgreSQL).

### 2. Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Настроить .env (скопировать из .env.example)
copy .env.example .env

# Применить миграции
alembic upgrade head

# Запустить
.\run.ps1
```
API поднимется на http://127.0.0.1:8000. Swagger — на /docs.

### 3. Frontend
```powershell
cd frontend
npm install
npm run dev
```
UI откроется на http://localhost:5173.

## Тесты
```powershell
cd backend
pytest tests/ -v
```
Тесты используют отдельную БД petroviz_test (создаётся автоматически в контейнере).

## Roadmap

- [x] Backend: парсинг LAS, REST API, 20 тестов
- [x] Frontend: визуализация, composite-треки, масштабы
- [x] PostgreSQL + SQLAlchemy + Alembic
- [x] Repository pattern + изолированные тесты
- [ ] Аутентификация (JWT, RBAC: admin / geophysicist / viewer)
- [ ] Admin panel: управление пользователями и доступом
- [ ] Петрофизические расчёты: Vshale, пористость, водонасыщенность
- [ ] Экспорт интерпретации (CSV, PDF)
- [ ] Деплой: VPS + Nginx + Let's Encrypt + CI/CD

## Лицензия

MIT