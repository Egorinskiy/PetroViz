import { apiClient } from './axiosClient';

export const computationsApi = {
  /**
   * Список доступных петрофизических методов.
   * Возвращает { methods: MethodSpec[] }
   */
  listMethods: () =>
    apiClient.get('/computations/methods').then((r) => r.data),

  /**
   * Расчёт без сохранения — для live-preview.
   * @param {string} wellId
   * @param {string} method - ключ метода
   * @param {Object} curveMapping - { role: mnemonic }
   * @param {Object} params - { paramName: value }
   * @returns {Promise<{depth: number[], curves: Object, warnings: string[]}>}
   */
  preview: (wellId, method, curveMapping, params, computationRefs) =>
    apiClient
      .post('/computations/preview', {
        well_id: wellId,
        method,
        curve_mapping: curveMapping,
        params,
        computation_refs: computationRefs || {},
      })
      .then((r) => r.data),

  /**
   * Возвращает кривую из LAS в формате preview — без расчёта.
   * Используется для B13 — внешние кривые в Express-пористости.
   * @param {string} wellId
   * @param {string} mnemonic - имя кривой из скважины
   * @returns {Promise<{mnemonic, unit, depth, values}>}
   */
  externalCurve: (wellId, mnemonic) =>
    apiClient
      .post('/computations/external-curve', {
        well_id: wellId,
        mnemonic,
      })
      .then((r) => r.data),

  /**
   * Сохраняет текущий расчёт (backend пересчитывает preview и сохраняет).
   * @returns {Promise<ComputationMeta>}
   */
  save: (wellId, payload) =>
    apiClient
      .post(`/wells/${wellId}/computations`, payload)
      .then((r) => r.data),

  /**
   * Список сохранённых расчётов для скважины.
   * @returns {Promise<ComputationMeta[]>}
   */
  listForWell: (wellId) =>
    apiClient
      .get(`/wells/${wellId}/computations`)
      .then((r) => r.data.items),

  /**
   * Полные данные сохранённого расчёта.
   * @returns {Promise<{id, output_mnemonic, method, depth, values}>}
   */
  getData: (compId) =>
    apiClient.get(`/computations/${compId}`).then((r) => r.data),

  /**
   * Удаляет сохранённый расчёт.
   */
  remove: (compId) =>
    apiClient.delete(`/computations/${compId}`),
};