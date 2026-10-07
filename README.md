# PetroViz

Веб-платформа для визуализации и базовой интерпретации данных каротажа скважин (well logs) в формате LAS.

> Дипломный проект студента Академии-Топ Васютинского Егора. Full-stack: FastAPI + React.

## Что умеет

- Загрузка LAS-файлов (версии 1.2 / 2.0) через веб-интерфейс.
- Парсинг, валидация и извлечение метаданных скважины.
- Интерактивная визуализация каротажа на треках (d3.js).
  - Composite-трек RHOB + NPHI с жёлтой заливкой в зоне кроссовера.
  - Composite-трек всех УЭС с логарифмической шкалой.
  - Автоматическое распознавание семейств кривых по мнемонике.
- Масштабы глубины: 1:200, 1:500, 1:1000, 1:2000, 1:5000, весь интервал.
- Три стратегии прореживания данных: fixed, adaptive, pixel.

## Структура

- `backend/` — FastAPI + lasio + pandas
- `frontend/` — React + Vite + d3

Каждая папка содержит собственный README с деталями.

## Быстрый старт

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
.\run.ps
```
API поднимется на http://127.0.0.1:8000. Swagger — на /docs.

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
UI откроется на http://localhost:5173. Vite проксирует /api/* на backend.

## Стек

| Слой     | Технологии                                         |
|----------|----------------------------------------------------|
| Backend  | Python 3.14, FastAPI, lasio, pandas, numpy, pytest |
| Frontend | React 18, Vite, d3.js, axios                       |

## Roadmap

- [x] Backend: парсинг LAS, REST API, 20 тестов
- [x] Frontend: визуализация, composite-треки, масштабы
- [ ] Петрофизические расчёты: Vshale, пористость, водонасыщенность
- [ ] Экспорт интерпретации (CSV, PDF)
- [ ] Сохранение проектов в PostgreSQL

## Лицензия

MIT