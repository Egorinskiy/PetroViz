import { useState, useEffect, useCallback, useRef } from 'react';
import { computationsApi } from '../api/computations';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Хук для live-preview петрофизических расчётов.
 *
 * Логика:
 *  1. При включении (enabled=true) — загружает список методов.
 *  2. Авто-выбирает первый метод, ставит дефолтные параметры.
 *  3. При любом изменении (метод / параметры / маппинг) — через debounce
 *     отправляет запрос на /computations/preview.
 *  4. Возвращает previewData для отрисовки на треке.
 */
export function useComputePreview({ wellId, enabled }) {
  const [methods, setMethods] = useState([]);
  const [methodsError, setMethodsError] = useState(null);

  const [selectedMethodKey, setSelectedMethodKey] = useState(null);
  const [curveMapping, setCurveMapping] = useState({});
  const [params, setParams] = useState({});

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const debounceRef = useRef(null);

  // --- 1. Загрузка списка методов (один раз) ---
  useEffect(() => {
    if (!enabled) return;
    if (methods.length > 0) return;

    let cancelled = false;
    computationsApi
      .listMethods()
      .then((data) => {
        if (cancelled) return;
        setMethods(data.methods);
        if (data.methods.length > 0) {
          const first = data.methods[0];
          setSelectedMethodKey(first.key);
          setParams(_buildDefaultParams(first));
          setCurveMapping(_buildDefaultMapping(first));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setMethodsError(err.response?.data?.detail || err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, methods.length]);

  // --- 2. Сброс параметров при смене метода ---
  useEffect(() => {
    if (!selectedMethodKey) return;
    const spec = methods.find((m) => m.key === selectedMethodKey);
    if (!spec) return;
    setParams(_buildDefaultParams(spec));
    setCurveMapping(_buildDefaultMapping(spec));
  }, [selectedMethodKey, methods]);

  // --- 3. Авто-preview с debounce ---
  // Для сравнения объектов используем JSON.stringify, чтобы effect
  // не срабатывал на каждый рендер из-за новой ссылки на объект.
  const paramsKey = JSON.stringify(params);
  const mappingKey = JSON.stringify(curveMapping);

  const runPreview = useCallback(async () => {
    if (!wellId || !selectedMethodKey) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await computationsApi.preview(
        wellId,
        selectedMethodKey,
        curveMapping,
        params
      );
      setPreviewData(data);
      setWarnings(data.warnings || []);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setPreviewError(
        typeof detail === 'string' ? detail : JSON.stringify(detail)
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [wellId, selectedMethodKey, curveMapping, params]);

  useEffect(() => {
    if (!enabled || !wellId || !selectedMethodKey) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runPreview();
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wellId, selectedMethodKey, paramsKey, mappingKey]);

  // --- 4. Сброс при закрытии панели / смене скважины ---
  useEffect(() => {
    if (!enabled) {
      setPreviewData(null);
      setPreviewError(null);
      setWarnings([]);
    }
  }, [enabled]);

  // --- Управление параметрами ---
  const setParam = useCallback((name, value) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setMapping = useCallback((role, mnemonic) => {
    setCurveMapping((prev) => ({ ...prev, [role]: mnemonic }));
  }, []);

  const selectedMethod = methods.find((m) => m.key === selectedMethodKey) || null;

  return {
    // Список методов
    methods,
    methodsError,
    selectedMethod,
    selectedMethodKey,
    setSelectedMethodKey,

    // Параметры
    params,
    setParam,
    curveMapping,
    setMapping,

    // Preview
    previewData,
    previewLoading,
    previewError,
    warnings,
    runPreview,
  };
}

// --- Хелперы ---

function _buildDefaultParams(spec) {
  const result = {};
  for (const [name, meta] of Object.entries(spec.params)) {
    result[name] = meta.default;
  }
  return result;
}

function _buildDefaultMapping(spec) {
  const result = {};
  for (const role of spec.requires) {
    result[role] = ''; // пусто = авто-детект на бэкенде
  }
  return result;
}