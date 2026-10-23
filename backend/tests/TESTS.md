# PetroViz — Документация по тестированию

В проекте реализовано **104 теста**, обеспечивающих покрытие критических узлов платформы. 
Тесты запускаются через `pytest` и используют отдельную тестовую базу данных (`petroviz_test`), чтобы не затрагивать dev/prod данные.

---

## 1. Блок API и скважин (`test_api.py` — 21 тест)

Проверяет базовые эндпоинты работы с LAS-файлами, корректность парсинга и отдачи данных.

*   **`test_upload_las`** — успешная загрузка LAS-файла и получение `well_id`.
*   **`test_get_well_info`** — получение метаданных (список кривых, глубины).
*   **`test_get_well_data`** — загрузка данных кривых с ограничением `max_points`.
*   **`test_list_my_wells`** — проверка списка доступных скважин для текущего пользователя.
*   **`test_upload_wrong_extension`** — ошибка 400 при загрузке файла не `.las`.
*   **`test_upload_empty_file`** — ошибка при загрузке пустого файла.
*   **`test_upload_garbage_file`** — ошибка при загрузке битого формата.
*   **`test_well_not_found`** — ошибка 404 при запросе несуществующей скважины.
*   **`test_curve_not_found`** — ошибка при запросе кривой, которой нет в файле.
*   **`test_nan_serialization`** — проверка, что `NaN` корректно сериализуются в JSON (не ломают ответ).
*   **`test_max_points_hard_limit`** — защита от запроса чрезмерно большого количества точек.
*   **`test_mode_fixed_default`** — проверка фиксированного шага прореживания по умолчанию.
*   **`test_mode_fixed_explicit`** — проверка явно заданного фиксированного шага.
*   **`test_mode_fixed_exceeds_hard_limit`** — защита от превышения лимита точек в режиме `fixed`.
*   **`test_mode_adaptive_without_depths`** — адаптивное прореживание без указания глубин.
*   **`test_mode_adaptive_with_range`** — адаптивное прореживание с указанием диапазона глубин.
*   **`test_mode_pixel_without_width`** — ошибка при пиксельном режиме без `pixel_width`.
*   **`test_mode_pixel_with_width`** — успешный пиксельный режим с шириной.
*   **`test_mode_invalid`** — ошибка 422 при передаче несуществующего режима.
*   **`test_mode_pixel_width_too_small`** — защита от слишком малой ширины в пиксельном режиме.
*   **`test_mode_pixel_width_too_large`** — защита от слишком большой ширины в пиксельном режиме.
*   **`test_wells_requires_auth`** — проверка, что эндпоинты скважин недоступны без токена (401).

---

## 2. Блок аутентификации и RBAC (`test_auth.py` — 12 тестов)

Проверяет систему регистрации, логина, обновления токенов и защиты от несанкционированного доступа.

*   **`test_register_success`** — успешная регистрация (по умолчанию роль `viewer`).
*   **`test_register_duplicate_username`** — ошибка 409 при дублировании логина.
*   **`test_register_duplicate_email`** — ошибка 409 при дублировании почты.
*   **`test_register_short_password`** — ошибка валидации при пароле менее 8 символов.
*   **`test_register_invalid_email`** — ошибка при невалидном формате email.
*   **`test_login_success`** — выдача пары `access` + `refresh` токенов.
*   **`test_login_wrong_password`** — ошибка 401 при неверном пароле.
*   **`test_login_nonexistent_user`** — ошибка 401 при несуществующем пользователе.
*   **`test_me_with_token`** — успешное получение профиля с валидным токеном.
*   **`test_me_without_token`** — ошибка 401 без токена.
*   **`test_me_with_invalid_token`** — ошибка 401 при битом токене.
*   **`test_refresh_token`** — успешное обновление пары токенов по refresh-токену.
*   **`test_refresh_with_access_token_fails`** — запрет использования access-токена для обновления.

---

## 3. Блок интеграции расчетов (`test_computation_refs.py` — 7 тестов)

Проверяет архитектуру `source_refs`: как бэкенд связывает расчеты (Swi/Sw/R0) с их источниками (VSH/PHI). Используется синтетический LAS-файл в памяти.

*   **`test_sw_archie_without_refs`** — ошибка, если для Sw не переданы обязательные `computation_refs`.
*   **`test_sw_archie_with_nonexistent_ref`** — ошибка, если передан несуществующий UUID источника.
*   **`test_sw_archie_with_wrong_category`** — ошибка, если вместо PHI (пористости) пытаются подсунуть VSH (глинистость).
*   **`test_sw_archie_success`** — успешный расчет Sw при наличии сохраненного PHI.
*   **`test_swi_bound_water_success`** — успешный расчет Swi (требует сохранения VSH и PHI).
*   **`test_r0_archie_success`** — успешный расчет R0 (требует только PHI).
*   **`test_save_swi_persists_sources`** — проверка, что при сохранении Swi в БД записываются связи `source_refs`.

---

## 4. Блок петрофизики: Пористость (`test_petrophysics_porosity.py` — 26 тестов)

Unit-тесты математических формул пористости с эталонными значениями.

**Класс `TestPorosityDensity` (6 тестов):**
*   `test_sandstone_water_basic` — базовая формула PHID для песчаника (ρm=2.65, ρf=1.0).
*   `test_limestone_matrix` — проверка PHID для матрицы известняка (ρm=2.71).
*   `test_clip_upper_bound` — обрезка сверху (очень низкая плотность → PHI_MAX).
*   `test_clip_lower_bound` — обрезка снизу (плотность выше матрицы → 0).
*   `test_nan_preserved` — сохранение `NaN` при пропусках во входных данных.
*   `test_invalid_matrix_less_than_fluid` — ошибка валидации (ρm < ρf).

**Класс `TestPorosityNeutron` (4 теста):**
*   `test_passthrough` — нейтронная пористость возвращается без изменений.
*   `test_negative_preserved` — отрицательные NPHI (газовый эффект) сохраняются.
*   `test_nan_preserved` — сохранение `NaN`.
*   `test_copy_not_view` — возвращается копия, а не ссылка (защита от мутаций).

**Класс `TestPorositySonic` (5 тестов):**
*   `test_sandstone_water_basic` — формула Wyllie (DTm=55.5, DTf=189).
*   `test_limestone_matrix` — проверка для известняка (DTm=47.5).
*   `test_clip_lower_bound` — обрезка снизу (DT < DTm → 0).
*   `test_nan_preserved` — сохранение `NaN`.
*   `test_invalid_fluid_less_than_matrix` — ошибка валидации (DTf < DTm).

**Класс `TestPorosityNeutronDensity` (6 тестов):**
*   `test_water_zone_average` — в водяной зоне NPHI ≈ PHID (среднее).
*   `test_gas_zone_rms` — в газовой зоне NPHI << PHID (RMS).
*   `test_mode_average_forced` — принудительный режим `average`.
*   `test_mode_rms_forced` — принудительный режим `rms`.
*   `test_nan_preserved` — сохранение `NaN`.
*   `test_unknown_mode_raises` — ошибка при неизвестном режиме.

**Класс `TestFluidZones` (7 тестов):**
*   `test_no_zones_baseline` — расчет без зон (базовый ρf).
*   `test_gas_zone_increases_phid` — в газовой зоне (ρf=0.2) PHID растет.
*   `test_oil_zone_slight_change` — в нефтяной зоне (ρf=0.8) PHID меняется незначительно.
*   `test_zone_outside_range_ignored` — зона вне глубин сэмплов игнорируется.
*   `test_multiple_zones` — несколько зон работают независимо.
*   `test_invalid_zone_skipped` — битая зона не ломает расчет.
*   `test_neutron_density_uses_fluid_zones` — PHI_ND учитывает зоны флюидов в PHID.

---

## 5. Блок петрофизики: Насыщенность (`test_petrophysics_swi_archie.py` — 19 тестов)

Unit-тесты для связанной воды (Swi), Арчи (Sw) и R0.

**Класс `TestSwiBoundWater` (8 тестов):**
*   `test_clean_sand` — чистый песок (Vsh=0, PHI=0.2).
*   `test_shale` — глина (Vsh=1, PHI=0.1) → обрезка до 1.0.
*   `test_mid_case` — промежуточный случай.
*   `test_clip_upper` — обрезка сверху (Swi > 1).
*   `test_clip_lower` — обрезка снизу (Swi < min).
*   `test_phi_zero_returns_clipped` — PHI=0 → inf → обрезка до 1.0.
*   `test_nan_preserved` — сохранение `NaN`.
*   `test_invalid_bounds` — ошибка при min > max.

**Класс `TestSwArchie` (8 тестов):**
*   `test_water_saturated` — Sw=1 (водонасыщенный пласт).
*   `test_half_saturated` — Sw=0.5.
*   `test_high_rt_low_sw` — высокое Rt → Sw=0.05.
*   `test_zero_rt_nan` — Rt=0 → NaN.
*   `test_zero_phi_nan` — PHI=0 → NaN.
*   `test_clip_low_rt` — низкое Rt → Sw > 1 → обрезка до 1.0.
*   `test_invalid_n` — ошибка при n <= 0.
*   `test_nan_preserved` — сохранение `NaN`.

**Класс `TestR0Archie` (4 теста):**
*   `test_r0_basic` — базовая формула R0.
*   `test_r0_zero_phi_nan` — PHI=0 → NaN.
*   `test_r0_equals_rt_at_sw_1` — при Sw=1 R0 == Rt.
*   `test_r0_nan_preserved` — сохранение `NaN`.

---

## 6. Блок петрофизики: NTG и Проницаемость (`test_petrophysics_ntg_perm.py` — 13 тестов)

Unit-тесты отсечек (cutoffs) и Тимур-Коатса.

**Класс `TestNtgCutoff` (8 тестов):**
*   `test_all_net` — все три кривые в норме → NTG=1.
*   `test_shaly_not_net` — Vsh > cutoff → не коллектор.
*   `test_low_phi_not_net` — PHI < cutoff → не коллектор.
*   `test_high_swi_not_net` — Swi > cutoff → не коллектор.
*   `test_boundary_exactly_at_cutoff` — строгие неравенства (на границе → не коллектор).
*   `test_custom_cutoffs` — кастомные отсечки.
*   `test_nan_propagates` — NaN в любом входе → NaN в выходе.
*   `test_invalid_cutoff` — ошибка при некорректном cutoff.

**Класс `TestPermTimurCoates` (5 тестов):**
*   `test_basic` — базовая формула Timur-Coates.
*   `test_zero_phi_nan` — PHI=0 → NaN.
*   `test_zero_swi_nan` — Swi=0 → NaN.
*   `test_nan_propagates` — сохранение `NaN`.
*   `test_negative_params_raise` — ошибка при отрицательных параметрах.

**Интеграционный тест:**
*   `test_ntg_perm_chain` — имитация цепочки Vsh → PHI → Swi → NTG/Perm (песок vs глина).