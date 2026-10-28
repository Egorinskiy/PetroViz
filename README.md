<img src="Logo/Logo_PV.png" width="120" align="left" style="margin-right: 20px; margin-bottom: 10px;" alt="PetroViz Logo" />

<h1 style="border-bottom: none; margin-top: 0;">PetroViz</h1>

**Веб-платформа для визуализации и петрофизической интерпретации данных каротажа скважин в формате LAS.**

- **Рабочая версия:** [https://petroviz.ru](https://petroviz.ru)
- **Автор:** Васютинский Егор (Академия ТОП)
- **Стек:** FastAPI + React + PostgreSQL + JWT-auth + RBAC

<small><i>⚠️ Примечание: платформа спроектирована как профессиональный инструмент для плотных графиков и оптимизирована для настольных компьютеров (Desktop). Мобильная адаптация находится в планах развития (см. Roadmap).</i></small>

<br clear="left"/>

---

## Стек технологий

![Python](https://img.shields.io/badge/Python-3.12+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker)
![D3.js](https://img.shields.io/badge/D3.js-F9A03C?style=for-the-badge&logo=d3.js)

---

## Основные возможности

### Обработка данных (LAS)
- Загрузка файлов LAS 1.2 / 2.0 через веб-интерфейс.
- Парсинг нестандартных файлов: разные кодировки (UTF-8, CP1251), дубликаты мнемоник, глубины под именами MD/TVD/DEPTH_M.
- Автоматическое распознавание семейств кривых (RHOB/RHOZ/ROBB/DEN -> плотность, ATxx -> УЭС и т.д.).
- Гибридное хранение: метаданные в PostgreSQL, массивы кривых в формате Parquet (высокая скорость чтения).

### Визуализация (D3.js)
- Интерактивные треки каротажа с обрезкой выбросов по перцентилям.
- Composite-треки: RHOB + NPHI с заливкой зоны кроссовера, все УЭС на логарифмической шкале.
- Физически корректные масштабы глубины (1:200, 1:500, 1:1000, 1:2000, 1:5000).
- Настройка шага сетки глубин и пользовательский диапазон отображения (кровля-подошва).
- Адаптивное прореживание данных (downsampling) для высокопроизводительного рендеринга.

### Петрофизические расчёты (14 методов)
- **Vshale (5):** линейный (Клавье), Ларионов x2, Штибер, ГГКп-ННКт.
- **Пористость (4):** PHID, PHIN, PHIS (Wyllie), PHI_ND (neutron-density crossplot).
- **Насыщенность (3):** Swi (bound water), Sw (Арчи), R0 (overlay на УЭС).
- **NTG/Perm (2):** cutoff-анализ, Timur-Coates.
- **Live-preview:** параметры меняются — кривая на треке обновляется за 400 мс.
- **Валидация:** Sw/Swi/R0 требуют валидированных Vsh и PHI из сохранённых расчётов. Полная воспроизводимость через `source_refs`.

### Экспорт данных
- **LAS 2.0:** Выгрузка исходных кривых и сохранённых расчётов (UTF-8).
- **CSV:** Выгрузка таблицы (UTF-8 BOM для Excel).
- **PDF:** Генерация векторного отчета 1:1 с планшетом (WYSIWYG). Шапка с логотипом и метаданными скважины.

### Пользователи и безопасность
- JWT-аутентификация (access + refresh токены).
- RBAC (Role-Based Access Control): роли `admin` / `geophysicist` / `viewer`.
- Админ-панель: управление пользователями, массовая выдача доступов (bulk-share).

### UI/UX
- Дизайн-система с токенами (slate-blue #2C5282), шрифты Geist Sans / Geist Mono.
- Регулируемые по ширине и сворачиваемые боковые панели.
- Сохранение состояния планшета (per-user).
- Стилизованные модалки и SVG-иконки.

---

## Структура проекта

~~~
.
├── backend/                 # FastAPI, SQLAlchemy, Alembic, парсинг LAS
│   ├── app/                 # Исходный код приложения
│   ├── tests/               # 104 теста (Pytest)
│   └── requirements.txt
├── frontend/                # React + Vite + d3.js
│   ├── src/
│   └── public/fonts/        # Шрифты Geist
├── docs/                    # USER_GUIDE.md, FAQ, скрипты PDF, скриншоты
├── docker-compose.prod.yml  # Конфигурация для продакшена (Nginx, DB, Backend)
├── PLAN.md                  # Роадмап и бэклог
├── DESIGN.md                # Дизайн-система
└── README.md
~~~

---

## Быстрый старт (Локально)

### 1. PostgreSQL

**Вариант A (Docker):**
~~~powershell
docker compose up -d postgres
~~~
*(БД на localhost:5433)*

**Вариант B (Локально):** Установите PostgreSQL 18+ и создайте БД `petroviz` и `petroviz_test`.

### 2. Backend
~~~powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Заполните в .env:
#   PETROVIZ_DATABASE_URL=postgresql+asyncpg://petroviz:PASSWORD@localhost:5432/petroviz
#   PETROVIZ_JWT_SECRET=<сгенерируйте: python -c "import secrets; print(secrets.token_hex(32))">
#   PETROVIZ_ADMIN_PASSWORD=<пароль первого админа>

alembic upgrade head
.\run.ps1
~~~
API доступен по адресу `http://127.0.0.1:8000`. Swagger документация: `/docs`.

### 3. Frontend
~~~powershell
cd frontend
npm install
npm run dev
~~~
UI доступен по адресу `http://localhost:5173`.

---

## Тестирование и CI/CD

~~~powershell
cd backend
pytest tests/ -v
~~~
На данный момент проект покрыт **104 тестами** (104 passed, 0 skipped). Покрыты API, петрофизические формулы (с эталонными значениями) и интеграция расчетов (`source_refs`).

**Деплой:** Настроен CI/CD через GitHub Actions. При пуше в ветку `main` изменения автоматически деплоятся на VPS (Ubuntu + Docker + Nginx).

---

## Документация

- [PLAN.md](PLAN.md) — Роадмап, история разработки и бэклог.
- [DESIGN.md](DESIGN.md) — Дизайн-система (цвета, типографика, компоненты).
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — Руководство пользователя.
- [docs/USER_GUIDE.pdf](docs/USER_GUIDE.pdf) — Руководство пользователя (PDF с обложкой).
- [backend/tests/TESTS.md](backend/tests/TESTS.md) — Подробное описание всех 104 тестов.

---

## Roadmap

### Готово
- Backend: парсинг LAS, REST API, 104 теста.
- Frontend: визуализация, composite-треки, масштабы, прореживание.
- Петрофизика: 14 методов + Express-пористость.
- Экспорт: LAS / CSV / PDF (WYSIWYG).
- PostgreSQL + SQLAlchemy + Alembic.
- JWT-auth + RBAC + Admin panel.
- Деплой на VPS (Docker, Nginx, HTTPS, CI/CD).

### В планах (Backlog)
- Минимальная мобильная адаптация (для админки).
- Настройка ручных шкал отображения кривых (Min/Max).
- Библиотека виртуальных кривых.
- Shaly correction (PHIE через Vsh).

## Лицензия
MIT