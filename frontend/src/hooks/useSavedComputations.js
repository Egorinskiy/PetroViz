import { useState, useEffect, useCallback } from 'react';
import { computationsApi } from '../api/computations';
import { extractErrorMessage } from '../utils/errors';

/**
 * Хук для работы со сохранёнными расчётами скважины.
 *
 * Возвращает:
 *  - items: список метаданных сохранённых расчётов
 *  - loading / error
 *  - save(payload): сохраняет текущий расчёт
 *  - remove(compId): удаляет
 *  - reload(): перезагружает список
 */
export function useSavedComputations({ wellId, enabled }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await computationsApi.listForWell(wellId);
      setItems(list);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось загрузить расчёты'));
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  // Загрузка при включении / смене скважины
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
      // Перезагружаем список
      await reload();
      return meta;
    },
    [wellId, reload]
  );

  const remove = useCallback(
    async (compId) => {
      await computationsApi.remove(compId);
      setItems((prev) => prev.filter((c) => c.id !== compId));
    },
    []
  );

  return { items, loading, error, save, remove, reload };
}