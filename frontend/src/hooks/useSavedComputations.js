import { useState, useEffect, useCallback } from 'react';
import { computationsApi } from '../api/computations';
import { extractErrorMessage } from '../utils/errors';

export function useSavedComputations({ wellId, enabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

    const reload = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await computationsApi.listForWell(wellId);

      // Если бэкенд вернул один объект (как на скриншоте), оборачиваем его в массив
      let list = [];
      if (Array.isArray(response)) {
        list = response;
      } else if (response && typeof response === 'object') {
        // Проверяем, есть ли внутри объект с id
        if (response.id) {
          list = [response];
        } else {
          list = response.items || response.data || response.results || [];
        }
      }

      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось загрузить расчёты'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    if (!enabled || !wellId) {
      setItems([]);
      return;
    }
    reload();
  }, [enabled, wellId, reload]);

  const save = useCallback(
    async (payload) => {
      if (!wellId) return null;
      const meta = await computationsApi.save(wellId, payload);
      await reload();
      return meta;
    },
    [wellId, reload]
  );

  const remove = useCallback(
    async (compId) => {
      await computationsApi.delete(compId);
      setItems((prev) => prev.filter((c) => c.id !== compId));
    },
    []
  );

  return { items, loading, error, save, remove, reload };
}