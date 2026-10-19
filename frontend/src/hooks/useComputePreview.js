import { useState, useEffect, useCallback, useRef } from 'react';
import { computationsApi } from '../api/computations';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Хук для live-preview петрофизических расчётов.
 *
 * Добавлена поддержка computation_refs — для методов Sw/Swi/R0,
 * которые требуют валидированных Vsh/PHI из сохранённых расчётов.
 */
export function useComputePreview({ wellId, enabled }) {
  const [methods, setMethods] = useState([]);
  const [methodsError, setMethodsError] = useState(null);

  const [selectedMethodKey, setSelectedMethodKey] = useState(null);
  const [curveMapping, setCurveMapping] = useState({});
  const [params, setParams] = useState({});
  const [computationRefs, setComputationRefs] = useState({});

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
        // НЕТ авто-выбора — пользователь сам выбирает метод.
        // Пустой dropdown → пустой планшет.
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
    setComputationRefs(_buildDefaultRefs(spec));
  }, [selectedMethodKey, methods]);

  // --- 3. Авто-preview с debounce ---
  const paramsKey = JSON.stringify(params);
  const mappingKey = JSON.stringify(curveMapping);
  const refsKey = JSON.stringify(computationRefs);

  const selectedMethod = methods.find((m) => m.key === selectedMethodKey) || null;

  // Проверка, что все обязательные refs выбраны
  const missingRefs = (() => {
    if (!selectedMethod) return [];
    const required = selectedMethod.requires_computations || {};
    const missing = [];
    for (const [role, req] of Object.entries(required)) {
      if (!computationRefs[role]) {
        missing.push({ role, label: req.label });
      }
    }
    return missing;
  })();

  const refsIncomplete = missingRefs.length > 0;

  const runPreview = useCallback(async () => {
    if (!wellId || !selectedMethodKey) return;
    if (refsIncomplete) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await computationsApi.preview(
        wellId,
        selectedMethodKey,
        curveMapping,
        params,
        computationRefs
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wellId, selectedMethodKey, curveMapping, params, computationRefs, refsIncomplete]);

  useEffect(() => {
    if (!enabled || !wellId) return;

    // Нет выбранного метода → очищаем preview (трек уходит с планшета)
    if (!selectedMethodKey) {
      setPreviewData(null);
      setPreviewError(null);
      setWarnings([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runPreview();
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wellId, selectedMethodKey, paramsKey, mappingKey, refsKey, refsIncomplete]);

  // --- 4. Полный сброс при закрытии панели (переоткрытие = чистый лист) ---
  useEffect(() => {
    if (!enabled) {
      setSelectedMethodKey(null);
      setParams({});
      setCurveMapping({});
      setComputationRefs({});
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

  const setComputationRef = useCallback((role, computationId) => {
    setComputationRefs((prev) => ({ ...prev, [role]: computationId }));
  }, []);

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

    // Источники (refs)
    computationRefs,
    setComputationRef,
    missingRefs,
    refsIncomplete,

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
    result[role] = '';
  }
  return result;
}

function _buildDefaultRefs(spec) {
  const result = {};
  const required = spec.requires_computations || {};
  for (const role of Object.keys(required)) {
    result[role] = '';
  }
  return result;
}