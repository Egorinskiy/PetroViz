# PetroViz

Веб-платформа для визуализации и базовой интерпретации данных каротажа скважин (well logs) в формате LAS.

> Дипломный проект студента Академии-Топ Васютинского Егора. Full-stack: FastAPI + React + PostgreSQL + JWT-auth + RBAC

## Что умеет

### Работа с LAS
- Загрузка LAS-файлов (версии 1.2 / 2.0) через веб-интерфейс.
- Парсинг с поддержкой нестандартных файлов: разные кодировки, дубликаты мнемоник, глубины под именами MD/TVD/DEPTH_M.
- Автоматическое распознавание семейств кривых (`RHOB/RHOZ/ROBB/DEN/...` → плотность, `ATxx` → УЭС и т.д.).
- Хранение метаданных в PostgreSQL, данных — в parquet-файлах.

### Визуализация (d3.js)
- Интерактивные треки каротажа с обрезкой выбросов по перцентилям.
- Composite-трек RHOB + NPHI с жёлтой заливкой в зоне кроссовера.
- Composite-трек всех УЭС на логарифмической шкале.
- Масштабы глубины: 1:200, 1:500, 1:1000, 1:2000, 1:5000, весь интервал.
- Три стратегии прореживания данных: `fixed`, `adaptive`, `pixel`.

### Пользователи и доступы
- JWT-аутентификация (access + refresh).
- RBAC: роли `admin`, `geophysicist`, `viewer`.
- Bootstrap первого администратора при первом запуске на пустой БД.
- Админ-панель: управление пользователями (роли, активация, удаление).
- Совместный доступ к скважинам: выдача/отзыв прав одиночно и **массово** (bulk-share).
- Sidebar на главной: «Мои скважины» (свои + расшаренные).

## Стек

| Слой     | Технологии |
|----------|-----------|
| Backend  | Python 3.14, FastAPI, lasio, pandas, numpy, SQLAlchemy 2.0, Alembic, PostgreSQL, JWT (python-jose), bcrypt, pydantic-settings, pytest |
| Frontend | React 18, Vite, d3.js, axios, react-router-dom |
| Инфра    | Docker, docker-compose |

## Структура

- `backend/` — FastAPI + lasio + SQLAlchemy + Alembic
- `frontend/` — React + Vite + d3.js
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

# Настроить .env (скопировать из .env.example и заполнить)
copy .env.example .env
# Задать реальный PETROVIZ_JWT_SECRET:
#   python -c "import secrets; print(secrets.token_hex(32))"
# Задать PETROVIZ_ADMIN_PASSWORD для bootstrap первого админа.

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
Тесты используют отдельную БД petroviz_test — dev-данные не трогаются.

## API

### Auth — аутентификация

| Метод | Путь | Описание |
|:---:|---|---|
| `POST` | `/api/auth/register` | Регистрация (роль `viewer`) |
| `POST` | `/api/auth/login` | Выдача access + refresh токенов |
| `POST` | `/api/auth/refresh` | Обновление пары токенов |
| `GET`  | `/api/auth/me` | Текущий пользователь |
| `POST` | `/api/auth/logout` | Выход |

### Wells — скважины

| Метод | Путь | Описание |
|:---:|---|---|
| `POST`   | `/api/wells/upload` | Загрузка LAS-файла |
| `GET`    | `/api/wells` | Доступные скважины (свои + shared) |
| `GET`    | `/api/wells/{id}` | Метаданные скважины |
| `GET`    | `/api/wells/{id}/data` | Данные кривых |
| `DELETE` | `/api/wells/{id}` | Удаление (только владелец) |

### Admin — админка (только роль `admin`)

| Метод | Путь | Описание |
|:---:|---|---|
| `GET`    | `/api/admin/users` | Список пользователей |
| `GET`    | `/api/admin/users/{id}` | Один пользователь |
| `PATCH`  | `/api/admin/users/{id}` | Изменение роли / статуса |
| `DELETE` | `/api/admin/users/{id}` | Удаление пользователя |
| `GET`    | `/api/admin/wells` | Все скважины всех пользователей |
| `GET`    | `/api/admin/wells/{id}/access` | Доступы к скважине |
| `POST`   | `/api/admin/wells/{id}/share` | Выдать доступ |
| `POST`   | `/api/admin/wells/bulk-share` | Массовая выдача доступов |
| `DELETE` | `/api/admin/wells/{id}/share/{user_id}` | Отозвать доступ |

---

## Roadmap

### ✅ Готово

- [x] **Backend:** парсинг LAS, REST API, 35 тестов
- [x] **Frontend:** визуализация, composite-треки, масштабы глубины
- [x] **PostgreSQL + SQLAlchemy + Alembic:** миграции, async-сессии, repository pattern
- [x] **JWT-auth + RBAC:** роли `admin` / `geophysicist` / `viewer`
- [x] **Admin panel:** пользователи, массовая выдача доступов к скважинам
- [x] **Sidebar «Мои скважины»:** свои + shared, выбор, удаление

### 🚧 В работе

- [ ] **Петрофизические расчёты:** Vshale, пористость, водонасыщенность

### 📅 Запланировано

- [ ] **Экспорт интерпретации:** CSV, PDF
- [ ] **Деплой:** VPS + Nginx + Let's Encrypt + CI/CD

## Лицензия

MIT