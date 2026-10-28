import { apiClient } from './axiosClient';

export const computationsApi = {
  listMethods: async () => {
    const response = await apiClient.get('/computations/methods');
    return response.data;
  },

  preview: async (wellId, method, params, curveMapping = {}, computationRefs = {}, fluidZones = null) => {
    const response = await apiClient.post('/computations/preview', {
      well_id: wellId,
      method,
      params,
      curve_mapping: curveMapping,
      computation_refs: computationRefs,
      fluid_zones: fluidZones,
    });
    return response.data;
  },

  save: async (wellId, payload) => {
    const response = await apiClient.post(`/wells/${wellId}/computations`, payload);
    return response.data;
  },

  listForWell: async (wellId) => {
    const response = await apiClient.get(`/wells/${wellId}/computations`);
    return response.data;
  },

  getData: async (compId) => {
    const response = await apiClient.get(`/computations/${compId}`);
    return response.data;
  },

  delete: async (compId) => {
    await apiClient.delete(`/computations/${compId}`);
  },

  getExternalCurve: async (wellId, curveName) => {
    const response = await apiClient.post('/computations/external-curve', {
      well_id: wellId,
      mnemonic: curveName,
    });
    return response.data;
  },

  exportLas: async (wellId, computationIds, includeSourceCurves = true, visibleCurves = null) => {
    const response = await apiClient.post(
      `/wells/${wellId}/export-las`,
      {
        computations: computationIds,
        include_source_curves: includeSourceCurves,
        visible_curves: visibleCurves, // <--- Передаем массив на бэкенд
      },
      { responseType: 'blob' }
    );

    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `well_${wellId.slice(0, 8)}.las`;

    return { blob: response.data, filename };
  },

  exportCsv: async (wellId, computationIds, includeSourceCurves = true) => {
    const response = await apiClient.post(
      `/wells/${wellId}/export-csv`, // <--- ИМЕННО -csv
      {
        computations: computationIds,
        include_source_curves: includeSourceCurves,
      },
      { responseType: 'blob' }
    );

    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `well_${wellId.slice(0, 8)}.csv`;

    return { blob: response.data, filename };
  },

  exportPdf: async (wellId, svgString) => {
    const response = await apiClient.post(
      `/wells/${wellId}/export-pdf`,
      { svg_content: svgString },
      { responseType: 'blob' }
    );

    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `well_${wellId.slice(0, 8)}.pdf`;

    return { blob: response.data, filename };
  },
};