# PetroViz

Веб-платформа для визуализации и петрофизической интерпретации данных каротажа скважин (well logs) в формате LAS.

> **Дипломный проект** студента Академии ТОП Васютинского Егора.
> Full-stack: FastAPI + React + PostgreSQL + JWT-auth + RBAC

## Что умеет

### Работа с LAS

- Загрузка LAS-файлов (версии 1.2 / 2.0) через веб-интерфейс
- Парсинг с поддержкой нестандартных файлов: разные кодировки, дубликаты мнемоник, глубины под именами MD/TVD/DEPTH_M
- Автоматическое распознавание семейств кривых (RHOB/RHOZ/ROBB/DEN → плотность, ATxx → УЭС и т.д.)
- Хранение метаданных в PostgreSQL, данных — в parquet-файлах

### Визуализация (d3.js)

- Интерактивные треки каротажа с обрезкой выбросов по перцентилям
- Composite-трек RHOB + NPHI с жёлтой заливкой в зоне кроссовера
- Composite-трек всех УЭС на логарифмической шкале с R0 overlay
- Масштабы глубины: 1:200, 1:500, 1:1000, 1:2000, 1:5000, весь интервал
- **Интерактивный шаг сетки глубин** (авто по масштабу + ручной)
- **Пользовательский диапазон отображения** (кровля-подошва)
- Три стратегии прореживания данных: fixed, adaptive, pixel

### Петрофизические расчёты (14 методов)

- **Vshale (5):** линейный (Клавье), Ларионов ×2, Штибер, ГГКп-ННКт
- **Пористость (4):** PHID, PHIN, PHIS (Wyllie), PHI_ND (neutron-density crossplot)
- **Насыщенность (3):** Swi (bound water), Sw (Арчи), R0 (overlay на УЭС)
- **NTG/Perm (2):** cutoff-анализ, Timur-Coates

**Live-preview:** параметры меняются — кривая на треке обновляется за 400 мс.

**Валидация источников:** Sw/Swi/R0 требуют валидированных Vsh и PHI из **сохранённых** расчётов — не самосчёт в фоне. Полная воспроизводимость через source_refs.

**Express-пористость:** вкладка с 4 методами + fluid zones + 6+ кросс-плотами + статистикой. Возможность подключать **внешние кривые** (ЯМК, керн) для сравнения с расчётной пористостью.

### Пользователи и доступы

- JWT-аутентификация (access + refresh)
- RBAC: роли admin / geophysicist / viewer
- Bootstrap первого администратора при первом запуске на пустой БД
- Админ-панель: управление пользователями
- Совместный доступ к скважинам: выдача / отзыв (одиночно + bulk-share)
- Sidebar «Мои скважины» (свои + расшаренные)

### UI/UX

- Дизайн-система с токенами: slate-blue #2C5282, шрифты Geist Sans / Geist Mono
- Двухколоночная страница входа с брендингом
- Регулируемые по ширине и сворачиваемые боковые панели
- Сохранение состояния (ширина панелей, шаг сетки, видимость блоков) в localStorage
- Стилизованные модалки (SaveComputationModal, AllComputationsModal, ConfirmDialog)
- SVG-иконки везде вместо эмодзи

## Стек

| Слой | Технологии |
|---|---|
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.0, Alembic, lasio, pandas, numpy, pyarrow |
| БД | PostgreSQL 18 + parquet (кривые) |
| Frontend | React 18, Vite, d3.js, axios, react-router-dom |
| Auth | JWT (access + refresh), bcrypt, RBAC |
| Стиль | Дизайн-система (slate-blue #2C5282), Geist Sans / Geist Mono |

### Дизайн-система

- **Шрифты:** Geist Sans + Geist Mono (variable, self-hosted)
- **Токены:** frontend/src/design/tokens.css
- **Компоненты:** frontend/src/design/components.css — .btn, .input, .table, .badge, .banner, .modal
- **Иконки:** frontend/src/components/Icons.jsx — SVG (Upload, Chart, Folder, Globe, Eye, Save, Trash, Curves)
- **Правила:** см. DESIGN.md

## Структура

~~~text
.
├── backend/             # FastAPI + lasio + SQLAlchemy + Alembic
├── frontend/            # React + Vite + d3.js
├── docker-compose.yml   # PostgreSQL для прода / dev-контейнера
├── PLAN.md              # роадмап и бэклог
├── DESIGN.md            # дизайн-система
└── README.md
~~~

Каждая папка содержит собственный README с деталями.

## Требования

- **Python** 3.11+
- **Node.js** 20+ и npm
- **PostgreSQL** 18 (локально или в Docker)

## Быстрый старт

### 1. PostgreSQL

**Вариант A — локальный (Windows):**

Установи PostgreSQL 18 с официального сайта. Создай БД и пользователя через psql:

~~~sql
CREATE USER petroviz WITH PASSWORD 'your_password';
CREATE DATABASE petroviz OWNER petroviz;
CREATE DATABASE petroviz_test OWNER petroviz;
~~~

**Вариант B — Docker:**

~~~powershell
docker compose up -d postgres
~~~

БД на localhost:5433 (порт 5432 часто занят локальным PostgreSQL).

### 2. Backend

~~~powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Заполни в .env:
#   PETROVIZ_DATABASE_URL=postgresql+asyncpg://petroviz:PASSWORD@localhost:5432/petroviz
#   PETROVIZ_JWT_SECRET=<сгенерируй: python -c "import secrets; print(secrets.token_hex(32))">
#   PETROVIZ_ADMIN_PASSWORD=<пароль первого админа>

alembic upgrade head
.\run.ps1
~~~

API: http://127.0.0.1:8000. Swagger: /docs.

### 3. Frontend

~~~powershell
cd frontend
npm install
npm run dev
~~~

UI: http://localhost:5173.

## Тесты

~~~powershell
cd backend
pytest tests/ -v
~~~

Тесты используют отдельную БД petroviz_test. Сейчас **104 теста** (101 passed, 3 skip из-за отсутствия GR/RHOB в sample.las).

## API

### Auth

| Метод | Путь | Описание |
|---|---|---|
| POST | /api/auth/register | Регистрация (роль viewer) |
| POST | /api/auth/login | access + refresh токены |
| POST | /api/auth/refresh | Обновление пары токенов |
| GET  | /api/auth/me | Текущий пользователь |
| POST | /api/auth/logout | Выход |

### Wells

| Метод | Путь | Описание |
|---|---|---|
| POST   | /api/wells/upload | Загрузка LAS |
| GET    | /api/wells | Доступные скважины |
| GET    | /api/wells/{id} | Метаданные |
| GET    | /api/wells/{id}/data | Данные кривых |
| DELETE | /api/wells/{id} | Удаление |

### Computations

| Метод | Путь | Описание |
|---|---|---|
| GET    | /api/computations/methods | Список методов |
| POST   | /api/computations/preview | Live-расчёт |
| POST   | /api/computations/external-curve | Кривая из LAS без расчёта |
| POST   | /api/wells/{id}/computations | Сохранить расчёт |
| GET    | /api/wells/{id}/computations | Список сохранённых |
| GET    | /api/computations/{id} | Данные сохранённого |
| DELETE | /api/computations/{id} | Удалить |

### Admin

| Метод | Путь |
|---|---|
| GET/PATCH/DELETE | /api/admin/users[/{id}] |
| GET | /api/admin/wells |
| POST | /api/admin/wells/{id}/share |
| POST | /api/admin/wells/bulk-share |
| DELETE | /api/admin/wells/{id}/share/{user_id} |

## Roadmap

### Готово

- Backend: парсинг LAS, REST API, 104 теста
- Frontend: визуализация, composite-треки, масштабы, интерактивная сетка, диапазон глубин
- PostgreSQL + SQLAlchemy + Alembic
- JWT-auth + RBAC
- Admin panel + bulk-share
- Дизайн-система (slate-blue, Geist, SVG-иконки)
- **Петрофизика: 14 методов** (Vshale, пористость, Swi/Sw/R0, NTG/Perm)
- Сохранение расчётов + source_refs
- Express-пористость: crossplots + stats + внешние кривые
- Регулируемые панели (ResizableSidebar)

### В работе

- USER_GUIDE.md + tooltips
- Мобильная адаптация

### Запланировано

- Экспорт CSV / PDF
- Деплой (VPS + Nginx + Let's Encrypt + CI/CD)
- Shaly correction (PHIE через Vsh)

## Лицензия

MIT

---

**Автор:** Васютинский Егор, Академия ТОП, 2026