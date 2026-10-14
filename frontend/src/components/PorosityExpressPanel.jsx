import React from 'react';
import { usePorosityExpress } from '../hooks/usePorosityExpress';

/**
 * Вкладка «Экспресс-пористость»:
 * 3 параллельных запроса → объединённый previewData → наверх в App.
 */
export function PorosityExpressPanel({ wellId, onResultChange }) {
  const { previewData, loading, error } = usePorosityExpress({
    wellId,
    enabled: !!wellId,
  });

  React.useEffect(() => {
    if (onResultChange) onResultChange(previewData);
  }, [previewData, onResultChange]);

  return (
    <div style={{ padding: 12 }}>
      <div className="computations-panel__section-title">
        Экспресс-анализ пористости
      </div>

      {loading && (
        <div className="text-sm text-muted" style={{ padding: '8px 0' }}>
          Расчёт 3 методов…
        </div>
      )}

      {error && <div className="banner banner--error">{error}</div>}

      {!loading && previewData && (
        <div style={{ fontSize: 12, marginTop: 8 }}>
          {Object.entries(previewData.curves).map(([mnemonic, curve]) => {
            const values = curve.values || [];
            const valid = values.filter((v) => v != null && isFinite(v)).length;
            const percent = values.length
              ? Math.round((valid / values.length) * 100)
              : 0;

            // Цвет в тон треку
            let color = '#666';
            if (mnemonic.startsWith('PHID')) color = '#E65100';
            else if (mnemonic.startsWith('PHIN')) color = '#0277BD';
            else if (mnemonic.startsWith('PHIS')) color = '#6A1B9A';

            return (
              <div
                key={mnemonic}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 4px',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <span style={{ fontWeight: 600, color }}>{mnemonic}</span>
                <span className="text-xs text-muted">
                  {valid} / {values.length} ({percent}%)
                </span>
              </div>
            );
          })}

          {previewData.warnings.length > 0 && (
            <div className="banner banner--warning" style={{ marginTop: 10 }}>
              {previewData.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11 }}>{w}</div>
              ))}
            </div>
          )}

          <div
            className="text-xs text-muted"
            style={{ marginTop: 10, lineHeight: 1.4 }}
          >
            Три кривые отображаются на планшете отдельными треками:
            <br />
            <span style={{ color: '#E65100', fontWeight: 600 }}>PHID</span> · {' '}
            <span style={{ color: '#0277BD', fontWeight: 600 }}>PHIN</span> · {' '}
            <span style={{ color: '#6A1B9A', fontWeight: 600 }}>PHIS</span>
          </div>
        </div>
      )}

      {!loading && !previewData && !error && (
        <div className="text-sm text-muted">Нет данных для расчёта.</div>
      )}
    </div>
  );
}