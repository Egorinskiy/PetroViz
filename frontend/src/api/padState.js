import { apiClient } from './axiosClient';

/**
 * API-клиент для сохранения состояния планшета (B29).
 */
export const padStateApi = {
  /**
   * Загружает сохранённое состояние для (user, well).
   * @returns {Promise<{state: object, updated_at: string|null}>}
   */
  get: (wellId) =>
    apiClient.get(`/wells/${wellId}/pad-state`).then((r) => r.data),

  /**
   * Сохраняет (создаёт или обновляет) состояние.
   * @param {string} wellId
   * @param {object} state
   * @returns {Promise<{state: object, updated_at: string|null}>}
   */
  save: (wellId, state) =>
    apiClient
      .put(`/wells/${wellId}/pad-state`, { state })
      .then((r) => r.data),

  /**
   * Удаляет сохранённое состояние.
   */
  remove: (wellId) =>
    apiClient.delete(`/wells/${wellId}/pad-state`),
};