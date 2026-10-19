# PetroViz — План развития

> **Дипломный проект:** Васютинский Егор, Академия ТОП  
> **Тема:** Веб-платформа визуализации и интерпретации данных каротажа скважин  
> **Репозиторий:** https://github.com/Egorinskiy/PetroViz

---

## 🎯 Цель проекта

Веб-приложение для загрузки, визуализации и петрофизической интерпретации LAS-файлов:
- Парсинг LAS (1.2 / 2.0) с нестандартными мнемониками
- Интерактивные треки каротажа (d3.js)
- Петрофизические расчёты (Vshale, пористость, Swi/Sw/R0, NTG, проницаемость)
- Сохранение расчётов в БД с полной воспроизводимостью (source_refs)
- Многопользовательский режим с ролями (admin / geophysicist / viewer)

---

## 🛠️ Стек

| Слой | Технологии |
|---|---|
| **Backend** | Python 3.14, FastAPI, SQLAlchemy 2.0, Alembic, lasio, pandas, numpy, pyarrow |
| **БД** | PostgreSQL 18 (метаданные) + parquet (кривые) |
| **Frontend** | React 18, Vite, d3.js, axios, react-router-dom |
| **Аутентификация** | JWT (access + refresh), bcrypt, RBAC |
| **Стиль** | Дизайн-система (slate-blue #2C5282), шрифты Geist Sans / Geist Mono |
| **Инфра** | Docker, docker-compose (для прода) |

---

## 🗺️ Общий роадмап

| Фаза | Что | Дней | Статус |
|---|---|---|---|
| 1 | Backend (LAS, REST API, тесты) | — | ✅ |
| 2 | Frontend (визуализация, composite, масштабы) | — | ✅ |
| 3 | Пользователи + Auth + Admin + PostgreSQL | — | ✅ |
| 3.5 | Дизайн-система + логотип + Geist | — | ✅ |
| **4** | **Петрофизические расчёты** | 7–9 | 🟡 **5/6 заходов** |
| 4.5 | **UI-полировка (B2–B28)** | — | 🟡 **закрыто 12/13** |
| 5 | Экспорт CSV / PDF | 2–3 | ⬜ |
| 6 | Деплой (VPS + Nginx + CI/CD) | 3–5 | ⬜ |
| 7 | Документация + защита | 5–7 | ⬜ |

---

## 📚 Фаза 4 — Петрофизика. Детализация

### Заходы

| # | Заход | Дней | Статус |
|---|---|---|---|
| 1 | **Vshale** — 5 методов | 2.5 | ✅ |
| 2 | **Пористость** + PHI_ND + fluid zones + crossplots + stats | 3 | ✅ |
| 3 | **Swi + Sw + R0** (computation_refs, validated Vsh/PHI) | 3 | ✅ |
| 4 | **NTG + Permeability** | 1.5 | ✅ |
| 5 | **Сохранение расчётов** (вне очереди) | 1.5 | ✅ |
| 6 | **USER_GUIDE.md + тултипы в UI** | 1 | ⬅️ **следующий** |

**Готовность Фазы 4:** 5/6 (84%). Осталась только документация.

### Реализованные методы (14 всего)

**Vshale (5):** vshale_linear, vshale_larionov_tertiary, vshale_larionov_older, vshale_stieber, vshale_neutron_density

**Пористость (4):** porosity_density, porosity_neutron, porosity_sonic, porosity_neutron_density (PHI_ND crossplot)

**Насыщенность (3):** swi_bound_water, sw_archie, r0_archie

**NTG/Perm (2):** ntg_cutoff, perm_timur_coates

### Ключевые архитектурные решения

- **Sw/Swi/R0 требуют `computation_refs`** — валидированные Vsh и PHI из сохранённых расчётов (не самосчёт в фоне)
- **Проверки при загрузке refs:** существует / та же скважина / правильная категория / глубины совпадают (жёстко, `np.allclose`)
- **`source_refs` в модели Computation** — полная воспроизводимость (видно, на чём основан расчёт)
- **Фиксированная лог-шкала [1, 500] Ом·м** на composite_res — для стабильности при настройке модели
- **Fluid zones** — ρf переопределяется по интервалам глубины (Static + Manual)
- **Внешние кривые в express** (B13) — добавление любой кривой из LAS (например, ЯМК) для сравнения с расчётной пористостью

### Заход 1 — Vshale ✅

5 методов:
- Клавье (линейный)
- Ларионов (tertiary)
- Ларионов (older)
- Штибер
- ГГКп-ННКт (neutron-density separation, 4 параметра)

Backend формулы + registry, frontend панель с live-preview, трек VSH (зелёный, 0→1), сохранение в БД.

### Заход 2 — Пористость ✅

**Методы:**
| Метод | Формула | Параметры |
|---|---|---|
| PHID (по плотности) | (ρm − ρb) / (ρm − ρf) | ρm, ρf (static или zones) |
| PHIN (по нейтрону) | NPHI напрямую | — |
| PHIS (по акустике, Wyllie) | (DT − DTm) / (DTf − DTm) | DTm, DTf |
| **PHI_ND** (crossplot) | auto: RMS в газовых, average в остальных | ρm, ρf, mode |

**Fluid zones** (Static + Manual zones с цветными полосками на треке).

**Экспресс-анализатор:**
- Вкладки «Треки / Кросс-плоты / Статистика»
- 6 кросс-плотов (все комбинации из 4 кривых) со сворачиванием
- Таблица статистики: mean / median / std / min / max + корреляции Пирсона
- **B13: внешние кривые** — dropdown «+ Добавить внешнюю кривую» (ЯМК, керн, etc.) с отдельной тёмной палитрой

### Заход 3 — Swi + Sw + R0 ✅

**Swi (bound water):**
Swi = clamp((C1 + C2 × Vsh) / PHI, SWI_MIN, SWI_MAX)
Дефолты: C1=0.015, C2=0.2, SWI_MIN=0.001, SWI_MAX=1.0

**Sw (Archie):**
Sw = ((a × Rw) / (PHI^m × Rt))^(1/n)
Дефолты: a=1.0, m=2.0, n=2.0, Rw=0.1 (лог-шкала слайдера)

**R0 overlay** (валидация на треке УЭС):
R0 = (a × Rw) / (PHI^m)

Отображается вместе с Rt на фиксированной лог-шкале [1, 500]. В водонасыщенных интервалах R0 ≈ Rt. **Placeholder** при отсутствии RT на планшете.

**Финальный трек SWI+SW:**
- Ось X: 1 → 0 (слева 1.0, справа 0.0)
- SW — синяя, толстая (2.5px)
- SWI — чёрная, тонкая
- Заливка от левого края (x=1) до SW — красная, alpha=0.25
- Заливка от SWI до правого края (x=0) — бирюзовая, alpha=0.3
- Между SW и SWI — **не заливать**

### Заход 4 — NTG + Permeability ✅

**NTG (cutoff-анализ):**
- Vsh < vsh_cutoff (0.4)
- PHI > phi_cutoff (0.08)
- **Swi < swi_cutoff (0.85)**
- Все отсечки — параметры с возможностью настройки в UI

**Permeability (Timur-Coates):**
K = (C × PHI^a) / Swi^b
Дефолты: C=10000, a=4.5, b=2.0
Отображение: лог-шкала 0.01–10000 мД, терракотовый цвет.

### Заход 6 — Документация ⬅️ следующий

- Раздел «Петрофизика» в USER_GUIDE.md
- Тултипы в UI (формулы + описание параметров)
- FAQ
- Примеры на реальных данных

---

## 🧩 Согласованная методология

### Роли кривых (маппинг «роль → мнемоника»)

| Роль | Автодетект | Используется в |
|---|---|---|
| `gr` | GR, GAM, GAPI, SGR, HSGR, GK | Vshale |
| `rhob` | RHOB, RHOZ, ROBB, DEN, ZDEN | Пористость (density) |
| `nphi` | NPHI, CNL, TNPH, NNK | Пористость (neutron), кросс-плот |
| `dtc` | DTC, DT, AC, SONIC, AK | Пористость (sonic) |
| `rt` | RDEP, RT, ILD, LLD, RES | Sw (Archie) — **выбор вручную** |
| `pef` | PEF, PE | (опционально) |

Автодетект — если кривой нет, dropdown пустой, пользователь выбирает сам.

### Live-preview

- Пользователь меняет параметр → debounce 400 мс → запрос `/api/computations/preview` → кривая на треке обновляется
- Preview — не сохраняется в БД
- Сохранение — отдельная кнопка «Сохранить расчёт»
- **B12:** параметры можно вводить вручную (двойной клик по числу → input → Enter)

### UI

- Все параметры (слайдеры, dropdown) — интерактивные
- **B21:** боковые панели регулируются по ширине (drag) + сворачиваются (localStorage)
- **B27:** блок кривых в топбаре скрывается/показывается кнопкой, имя скважины в топбаре
- **B28:** приложение на всю ширину экрана (без max-width)
- Роли кривых — dropdown с автодетектом
- Вкладки: «Треки / Кросс-плоты / Статистика»
- **B8:** двухколоночная страница логина (баннер + форма)

---

## 📌 Ключевые файлы


### Backend
backend/app/
├── services/petrophysics/
│ ├── vshale.py # ✅ 5 методов Vshale
│ ├── porosity.py # ✅ 4 метода (PHID/PHIN/PHIS/PHI_ND)
│ ├── swi.py # ✅ Swi (bound water)
│ ├── archie.py # ✅ Sw + R0
│ ├── ntg.py # ✅ NTG cutoff
│ └── permeability.py # ✅ Timur-Coates
├── computation/
│ ├── service.py # ComputationService.compute_preview + _load_computation_refs
│ ├── schemas.py # ComputeRequest/Response, ExternalCurve
│ └── computation_schemas.py
├── repositories/
│ └── computation_repository.py # сохранение в parquet + БД
├── api/computations.py # preview, save, list, external-curve
└── db/models.py # Well, User, Computation (с source_refs)

### Frontend
frontend/src/
├── components/
│ ├── WellLogViewer.jsx # рендер треков + preview + saved + express + R0 overlay + SW/SWI
│ ├── ComputationsPanel.jsx # панель расчётов (одиночный + экспресс)
│ ├── PorosityExpressPanel.jsx # express + внешние кривые
│ ├── PorosityCrossplots.jsx # 6 кросс-плотов
│ ├── PorosityStatistics.jsx # таблицы статистики
│ ├── FluidZonesEditor.jsx # редактор зон
│ ├── SourceSelector.jsx # dropdown для refs
│ ├── ResizableSidebar.jsx # регулируемые панели (B21)
│ ├── Icons.jsx # SVG-иконки
│ ├── Topbar.jsx # кнопки Curves / Computations + well name
│ ├── ParamSlider.jsx # слайдер + ручной ввод (B12)
│ └── Logo.jsx # PetroViz / PV монограмма
├── hooks/
│ ├── useComputePreview.js
│ ├── useSavedComputations.js
│ └── usePorosityExpress.js
├── api/
│ └── computations.js
├── pages/
│ ├── LoginPage.jsx # двухколоночная (B8)
│ └── RegisterPage.jsx
├── design/
│ ├── tokens.css # slate-blue palette (B5)
│ └── components.css
└── App.css


---

## 🐞 Бэклог

### ✅ Закрыто (сессия 2026-10-14 → 2026-10-20)

- [x] **B1. Админка не работает** ✅ *(2026-10-14)*
  - Фикс: `AdminRoute.jsx` + роуты `/admin/users`, `/admin/wells`

- [x] **B2. Логотип переработан (PV relocation)** ✅ *(2026-10-20)*
  - Crossover убран из топбара (только текст «PetroViz» 32px)
  - PV-монограмма: welcome-screen, auth-banner, favicon
  - Footer auth-страниц: «Васютинский Егор» вместо «Академия ТОП»

- [x] **B4. Кнопки топбара выровнены** ✅ *(2026-10-20)*
  - Убран `btn--sm` у «Расчёты», добавлены SVG-иконки

- [x] **B5. Slate-blue palette (#2C5282)** ✅ *(2026-10-20)*
  - `--color-accent-blue` → #2C5282
  - `--color-info` синхронизирован
  - Focus-обводки, прогресс-бар, hover-тени

- [x] **B8. Логин-страница переработана** ✅ *(2026-10-20)*
  - Двухколоночный layout: градиентный баннер + форма
  - Чипы методов (Vshale / PHI / Sw / NTG / K) в списке фич
  - Мобильная адаптация (одна колонка)

- [x] **B9. Favicon + title + meta** ✅ *(2026-10-20)*
  - PV-монограмма в белом скруглённом квадрате
  - Title: «PetroViz — интерпретация каротажа скважин»
  - meta description + theme-color + lang="ru"

- [x] **B12. Ручной ввод параметров (двойной клик)** ✅ *(2026-10-20)*
  - `ParamSlider.jsx` + `ExpressSlider` в `PorosityExpressPanel`
  - Enter → применить, Escape → отмена

- [x] **B13. Внешние кривые в express-пористости** ✅ *(2026-10-20)*
  - Endpoint `/computations/external-curve`
  - Dropdown «+ Добавить внешнюю кривую» в панели
  - Сплошные линии тёмных цветов на треке (не пунктир)
  - Работает в статистике и на треке

- [x] **B14. Слайдеры slate-blue** ✅ *(2026-10-20, в составе B5)*
  - Глобальное правило `input[type='range'] { accent-color: var(--color-accent-blue) }`

- [x] **B15. Fluid zones (backend + frontend)** ✅ *(2026-10-14)*
  - Параметр `fluid_zones: [{from, to, rho_fluid}]`
  - UI редактор + визуализация на express-треке
  - Подписи «Газ 0.20», «Нефть 0.80»

- [x] **B21. Регулируемые + скрываемые боковые панели** ✅ *(2026-10-20)*
  - `ResizableSidebar` с drag + collapse
  - localStorage (ширина + состояние)
  - SVG-иконки в свёрнутом виде (FolderIcon / ChartIcon 22px)

- [x] **B27. Toggle блока кривых в топбаре** ✅ *(2026-10-20)*
  - Кнопка «Кривые» в топбаре (primary / secondary)
  - Имя скважины перенесено в топбар
  - Удалена кнопка «Изменить ▼» из CurvesBar
  - `well-header` удалён
  - localStorage `petroviz.topbar.curvesVisible`

- [x] **B28. Full-width layout** ✅ *(2026-10-20)*
  - Убран `max-width: 1600px` у `.App`
  - Приложение на всю ширину экрана

### 🐞 Открытые баги

- [ ] **B26. Внешние кривые не отображаются на кросс-плотах** 🔥
  - Причина: `PorosityCrossplots.jsx` содержит **жёстко зашитый** массив `PAIRS` из 4 встроенных кривых
  - **Решение:** динамически генерировать пары из `Object.keys(curves)`
  - **Приоритет:** 🔥 высокий — нарушает ключевой сценарий B13

### UX панели расчётов

- [ ] **B3. Компактное отображение сохранённых** ⚡
  - Timestamp + custom name при сохранении
  - В текущей вкладке — последние N, всё остальное — в модалке / роуте `/computations`

- [ ] **B7. Вертикальные линии параметров на треках** ⚡
  - При движении ползунка — линия на треке исходной кривой
  - `rho_matrix` / `rho_fluid` на RHOB, `gr_min` / `gr_max` на GR

- [ ] **B17. Fluid zones в одиночных расчётах** ⚡
  - Переиспользовать `FluidZonesEditor` в `ComputationsPanel` → «Одиночный»
  - Backend уже готов

- [ ] **B18. Интерактивное задание кровли-подошвы зоны** ⚡
  - Клик на планшете → 2 глубины → зона создана
  - Требует координации с `WellLogViewer`

- [ ] **B19. Сворачивание блоков панели расчётов** ⚡
  - «Параметры», «Зоны флюидов» → collapse по клику
  - Состояние в localStorage

### Дизайн и UI

- [ ] **B6. Кнопка выбора произвольной кровли-подошвы** ⚡
  - Рядом с dropdown «Масштаб»
  - Компонент `DepthRangePicker.jsx`

- [ ] **B10. Интерактивная сетка глубин** ⚡
  - Шаг сетки зависит от масштаба (1:200 → 2 м, 1:5000 → 50 м)
  - Плюс ручной выбор шага

- [ ] **B11. Синхронизация прореживания** *(частично: pixel_width 900→3000)*
  - Осталось: ресемплинг preview под wellData.depth
  - Приоритет понижен (на 1:500+ незаметно)
  - 
- [ ] **B29. Кнопка «Сохранить планшет» — состояние визуализации per-user**
  - Сохраняет текущий вид планшета: набор выбранных кривых, треков, масштаб,
    видимость блоков (curvesVisible, panelOpen), activeWellId, zones, savedTracks
  - При следующем открытии платформы/скважины — восстанавливает как было
  - **Архитектурная развилка (обсудить):**
    - **Вариант A — localStorage** (быстро): `petroviz.pad.{userId}.{wellId}`
      - ✅ Не требует backend, работает сразу, изоляция по пользователю (через ключ)
      - ❌ Только на одном браузере/устройстве (не синхронизируется)
      - ❌ При очистке кэша — потеря
    - **Вариант B — backend** (правильно): модель `PadState` (user_id + well_id + JSON state)
      - ✅ Синхронизация между устройствами
      - ✅ Живёт с проектом, не теряется
      - ❌ Нужна модель + миграция + endpoint (save/load)
      - ~2-3 часа работы
  - **UX:**
    - Кнопка «💾 Сохранить планшет» в топбаре (рядом с «Кривые» / «Расчёты»)
    - Индикатор «Сохранено» (зелёная галочка / fade-out через 2 сек)
    - Опционально: dropdown «Сбросить к сохранённому» (или отдельная кнопка)
  - **Что входит в state:**
    - `selectedCurves: string[]`
    - `scale: string`
    - `curvesVisible: boolean`
    - `activeWellId: string`
    - `fluidZones: array`
    - `savedTracks: array` (id сохранённых расчётов, показанных на треке)
    - `computationsOpen: boolean`
    - `sidebarWidths: {left, right}` (можно из localStorage, уже есть)
  - **Приоритет:** ⚡ средний — улучшает UX, но не критично для диплома
  - **Зависимость:** решить A/B перед реализацией
  - 
### Технический долг

- [ ] **B22. Дописать integration-тесты refs (3 skip)** ⚡
  - `test_sw_archie_with_wrong_category`, `test_swi_bound_water_success`, `test_save_swi_persists_sources`
  - Skip из-за отсутствия GR/RHOB в sample.las
  - **Решение:** синтетический LAS в памяти теста (GR=0..150, RHOB=2.0..2.6, RDEP=1..100)

- [ ] **B23. Отображение источника у сохранённого расчёта** ⚡
  - В списке: `SWI (из VSH#a3f1, PHI#b7c2)`
  - Tooltip: полные имена методов + даты

### Stretch (если останется время)

- [ ] **B16. Shaly correction (PHIE через Vsh)** 🎯
  - PHIE = PHIT − Vsh × PHI_sh
  - Вход: сохранённый VSH + PHI
  - Параметры: ρ_sh (2.5), NPHI_sh (0.35), DT_sh (75), PHI_sh (0.10)

- [ ] **B24. Флюид для PHIN** 🎯
  - Для газовых зон NPHI сильно занижен
  - `NPHI_corr = NPHI × (1 − Sw × gas_effect)`

- [ ] **B25. Мультиминеральная модель (упрощённая)** 🎯
  - 4 компонента: quartz + clay + calcite + porosity
  - `scipy.optimize.lsq_linear` с ограничениями

---

## 📅 Следующие фазы

### Фаза 5 — Экспорт (2–3 дня)
- `GET /api/wells/{id}/export.csv` — кривые + расчёты
- `GET /api/wells/{id}/export.pdf` — отчёт с графиками (reportlab / weasyprint)
- Кнопка «Экспорт» в топбаре

### Фаза 6 — Деплой (3–5 дней)
- VPS Timeweb (~400 ₽/мес), домен .ru
- Docker для backend + frontend
- Nginx реверс-прокси
- HTTPS (Let's Encrypt)
- CI/CD (GitHub Actions → SSH deploy)
- Бэкапы, мониторинг

### Фаза 7 — Документация + защита (5–7 дней)
- Дипломная записка (40–60 страниц)
- Презентация (15–20 слайдов)
- Демо-сценарий
- USER_GUIDE.md (отдельно от Захода 6, но может быть частью)

---

## 🔄 Как возобновить работу в новом чате

**Скопируй в первое сообщение:**

> Проект PetroViz, диплом.
> PLAN.md: https://github.com/Egorinskiy/PetroViz/blob/main/PLAN.md
> Последний коммит: 8a452c4
>
> Фаза 4 (петрофизика) — 5/6 заходов закрыто (Vshale, Пористость, Swi/Sw/R0, NTG/Perm, Сохранение).
> Фаза 4.5 (UI-полировка) — закрыто 12/13, остался только B26 (внешние на кросс-плотах).
> Осталось: Заход 6 — USER_GUIDE.md + тултипы.
> Или переключаемся на Фазу 5 (экспорт), Фазу 6 (деплой).

**Ключевые фразы:**
- «Заход 6» — USER_GUIDE
- «Фаза 5» — экспорт CSV/PDF
- «Фаза 6» — деплой
- «B26» — баг с внешними на кросс-плотах
- «B3» — компактный список сохранённых

---

## 💡 Принципы

1. **Сначала методология — потом код.** Прежде чем писать формулу, обсуждаем физику и параметры.
2. **Реалистичность важнее «крутости».** Waxman-Smits звучит солидно, но требует данных, которых нет. Арчи + Ларионов — то, что применимо и защищаемо.
3. **Документация в каждом заходе.** USER_GUIDE.md + тултипы — не опция, а обязательная часть.
4. **Live-preview везде.** Пользователь двигает слайдер → видит результат. Это фишка проекта.
5. **Не переусложнять.** Для диплома хватает 3–5 методов на блок.

---

**Последнее обновление:** 2026-10-20  
**Текущий этап:** Фаза 4.5 — закрыто 12/13 (B2, B4, B5, B8, B9, B12, B13, B14, B15, B21, B27, B28)  
**Следующий шаг:** B26 (внешние на кросс-плотах) → Заход 6 (USER_GUIDE) → Фаза 5 (экспорт)  
**Всего методов:** 14 (Vshale 5, Porosity 4, Swi/Sw/R0 3, NTG/Perm 2)  
**Тестов:** 104 (101 passed, 3 skip)  
**Последний коммит:** 8a452c4