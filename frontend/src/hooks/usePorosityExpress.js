import { useState, useEffect, useCallback, useRef } from 'react';
import { computationsApi } from '../api/computations';

const DEBOUNCE_MS = 400;

// Три метода пористости с дефолтными параметрами и маппингом
const METHODS = [
  {
    key: 'porosity_density',
    label: 'PHID',
    mapping: { rhob: '' },
    params: { rho_matrix: 2.65, rho_fluid: 1.0 },
  },
  {
    key: 'porosity_neutron',
    label: 'PHIN',
    mapping: { nphi: '' },
    params: {},
  },
  {
    key: 'porosity_sonic',
    label: 'PHIS',
    mapping: { dtc: '' },
    params: { dt_matrix: 55.5, dt_fluid: 189.0 },
  },
];

/**
 * Экспресс-анализ пористости: 3 параллельных запроса (PHID, PHIN, PHIS),
 * объединение результатов в один previewData.
 */
export function usePorosityExpress({ wellId, enabled }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [perMethod, setPerMethod] = useState({});
  const debounceRef = useRef(null);

  const run = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        METHODS.map((m) =>
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
  }, [wellId]);

  useEffect(() => {
    if (!enabled || !wellId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(run, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, wellId, run]);

  useEffect(() => {
    if (!enabled) {
      setPreviewData(null);
      setError(null);
      setPerMethod({});
    }
  }, [enabled]);

  return { previewData, loading, error, perMethod, run };
}