import { apiClient } from './axiosClient';

export const adminApi = {
  // --- Users ---
  listUsers: (params = {}) =>
    apiClient.get('/admin/users', { params }).then((r) => r.data),

  getUser: (id) =>
    apiClient.get(`/admin/users/${id}`).then((r) => r.data),

  updateUser: (id, data) =>
    apiClient.patch(`/admin/users/${id}`, data).then((r) => r.data),

  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),

  // --- Wells ---
  listAllWells: (params = {}) =>
    apiClient.get('/admin/wells', { params }).then((r) => r.data),

  listWellAccess: (wellId) =>
    apiClient.get(`/admin/wells/${wellId}/access`).then((r) => r.data),

  shareWell: (wellId, userId, permission = 'read') =>
    apiClient
      .post(`/admin/wells/${wellId}/share`, {
        user_id: userId,
        permission,
      })
      .then((r) => r.data),

  revokeWellAccess: (wellId, userId) =>
    apiClient.delete(`/admin/wells/${wellId}/share/${userId}`),

  // --- Bulk ---
  bulkShareWells: (wellIds, userId, permission = 'read') =>
    apiClient
      .post('/admin/wells/bulk-share', {
        well_ids: wellIds,
        user_id: userId,
        permission,
      })
      .then((r) => r.data),
};