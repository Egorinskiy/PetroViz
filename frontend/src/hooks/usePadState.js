import { useCallback, useState } from 'react';
import { padStateApi } from '../api/padState';
import { computationsApi } from '../api/computations';
import { extractErrorMessage } from '../utils/errors';

/**
 * Хук для работы с сохранённым состоянием планшета (B29).
 *
 * - save(wellId, snapshot) — сохраняет снимок на backend
 * - restore(wellId) — загружает снимок, возвращает нормализованный объект
 *   (с восстановленными данными savedTracks)
 */
export function usePadState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Сохраняет состояние планшета.
   * @param {string} wellId
   * @param {object} snapshot — снимок state
   */
  const save = useCallback(async (wellId, snapshot) => {
    if (!wellId) return null;
    setError(null);
    try {
      const data = await padStateApi.save(wellId, snapshot);
      return data;
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось сохранить планшет'));
      throw err;
    }
  }, []);

  /**
   * Загружает снимок и восстанавливает данные savedTracks
   * (заново запрашивает значения расчётов через API).
   *
   * @param {string} wellId
   * @returns {Promise<object|null>} — восстановленный state или null
   */
  const restore = useCallback(async (wellId) => {
    if (!wellId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await padStateApi.get(wellId);
      const state = data?.state || {};
      if (!state || Object.keys(state).length === 0) {
        return null;
      }

      // Восстанавливаем savedTracks — заново загружаем данные расчётов
      let restoredSavedTracks = [];
      const trackIds = Array.isArray(state.savedTracks) ? state.savedTracks : [];
      if (trackIds.length > 0) {
        const results = await Promise.all(
          trackIds.map(async (id) => {
            try {
              const cdata = await computationsApi.getData(id);
              return {
                id,
                mnemonic: cdata.output_mnemonic,
                label: cdata.output_mnemonic,
                depth: cdata.depth,
                values: cdata.values,
                method: cdata.method,
                category: state.savedTracksCategories?.[id] || null,
              };
            } catch {
              // Расчёт мог быть удалён — тихо пропускаем
              return null;
            }
          })
        );
        restoredSavedTracks = results.filter(Boolean);
      }

      return {
        selectedCurves: state.selectedCurves,
        scale: state.scale,
        curvesVisible: state.curvesVisible,
        gridStep: state.gridStep,
        depthRange: state.depthRange,
        fluidZones: state.fluidZones,
        savedTracks: restoredSavedTracks,
        savedTracksIds: trackIds,
        computationsOpen: state.computationsOpen,
      };
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось загрузить планшет'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { save, restore, loading, error };
}