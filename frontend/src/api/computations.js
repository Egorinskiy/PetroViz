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
  preview: (wellId, method, curveMapping, params) =>
    apiClient
      .post('/computations/preview', {
        well_id: wellId,
        method,
        curve_mapping: curveMapping,
        params,
      })
      .then((r) => r.data),
};