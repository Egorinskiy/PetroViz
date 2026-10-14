import { useState, useEffect, useCallback, useRef } from 'react';
import { computationsApi } from '../api/computations';

const DEBOUNCE_MS = 400;

// Дефолты параметров express
export const DEFAULT_EXPRESS_PARAMS = {
  rho_matrix: 2.65,
  rho_fluid: 1.0,
  dt_matrix: 55.5,
  dt_fluid: 189.0,
};

// Пресеты литологии
export const LITHOLOGY_PRESETS = {
  sandstone: { label: 'Песчаник (кварц)', rho_matrix: 2.65, dt_matrix: 55.5 },
  limestone: { label: 'Известняк',        rho_matrix: 2.71, dt_matrix: 47.5 },
  dolomite:  { label: 'Доломит',          rho_matrix: 2.87, dt_matrix: 43.5 },
};

// Пресеты флюидов для зон
export const FLUID_PRESETS = {
  water:  { label: 'Вода',       rho: 1.0,  color: '#0277BD' },
  oil:    { label: 'Нефть',      rho: 0.8,  color: '#2E7D32' },
  gas:    { label: 'Газ',        rho: 0.2,  color: '#C62828' },
  custom: { label: 'Кастомный',  rho: null, color: '#666666' },
};

/**
 * Собирает 4 метода express с учётом текущих параметров и fluid zones.
 */
function buildMethods(p, fluidZones) {
  const zones = fluidZones && fluidZones.length > 0 ? fluidZones : undefined;

  return [
    {
      key: 'porosity_density',
      label: 'PHID',
      mapping: { rhob: '' },
      params: {
        rho_matrix: p.rho_matrix,
        rho_fluid: p.rho_fluid,
        fluid_zones: zones,
      },
    },
    {
      key: 'porosity_neutron',
      label: 'PHIN',
      mapping: { nphi: '' },
      params: {},
    },
    {
      key: 'porosity_neutron_density',
      label: 'PHI_ND',
      mapping: { rhob: '', nphi: '' },
      params: {
        rho_matrix: p.rho_matrix,
        rho_fluid: p.rho_fluid,
        fluid_zones: zones,
      },
    },
    {
      key: 'porosity_sonic',
      label: 'PHIS',
      mapping: { dtc: '' },
      params: { dt_matrix: p.dt_matrix, dt_fluid: p.dt_fluid },
    },
  ];
}

export function usePorosityExpress({ wellId, enabled, expressParams, fluidZones }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [perMethod, setPerMethod] = useState({});
  const debounceRef = useRef(null);

  const params = expressParams || DEFAULT_EXPRESS_PARAMS;
  // Ключ зависит и от params, и от zones — чтобы debounce срабатывал при любых изменениях
  const paramsKey = JSON.stringify(params);
  const zonesKey = JSON.stringify(fluidZones || []);

  const run = useCallback(async () => {
    if (!wellId) return;
    const methods = buildMethods(params, fluidZones);
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        methods.map((m) =>
          computationsApi
            .preview(wellId, m.key, m.mapping, m.params)
            .then((data) => ({ ok: true, key: m.key, mnemonic: m.label, data }))
            .catch((err) => ({
              ok: false,
              key: m.key,
              mnemonic: m.label,
              error: err.response?.data?.detail || err.message,
            }))
        )
      );

      const merged = { depth: null, curves: {}, warnings: [] };
      const pm = {};

      for (const r of results) {
        if (!r.ok) {
          merged.warnings.push(`${r.mnemonic}: ${r.error}`);
          continue;
        }
        if (!merged.depth) merged.depth = r.data.depth;
        for (const [mnemonic, curve] of Object.entries(r.data.curves)) {
          merged.curves[mnemonic] = curve;
        }
        merged.warnings.push(...(r.data.warnings || []));
        pm[r.key] = r.data;
      }

      setPreviewData(merged);
      setPerMethod(pm);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wellId, paramsKey, zonesKey]);

  useEffect(() => {
    if (!enabled || !wellId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, wellId, run, paramsKey, zonesKey]);

  useEffect(() => {
    if (!enabled) {
      setPreviewData(null);
      setError(null);
      setPerMethod({});
    }
  }, [enabled]);

  return { previewData, loading, error, perMethod, run };
}