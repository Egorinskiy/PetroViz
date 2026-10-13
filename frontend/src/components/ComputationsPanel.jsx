import React from 'react';
import { useComputePreview } from '../hooks/useComputePreview';
import { MethodSelector } from './MethodSelector';
import { ParamSlider } from './ParamSlider';
import { CurveMappingSelect } from './CurveMappingSelect';

export function ComputationsPanel({ well, onPreviewChange, onClose }) {
  const wellId = well?.well_id || null;
  const availableCurves = well?.curves || [];

  const {
    methods,
    methodsError,
    selectedMethod,
    selectedMethodKey,
    setSelectedMethodKey,
    params,
    setParam,
    curveMapping,
    setMapping,
    previewData,
    previewLoading,
    previewError,
    warnings,
  } = useComputePreview({ wellId, enabled: !!wellId });

  // Пробрасываем preview-данные наверх в App.jsx (для трека)
  React.useEffect(() => {
    if (onPreviewChange) onPreviewChange(previewData);
  }, [previewData, onPreviewChange]);

  // --- Заглушка: скважина не выбрана ---
  if (!wellId) {
    return (
      <aside className="computations-panel">
        <div className="computations-panel__header">
          <h3>Расчёты</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 20 }}>
          Выберите скважину слева, чтобы начать расчёт.
        </p>
      </aside>
    );
  }

  return (
    <aside className="computations-panel">
      <div className="computations-panel__header">
        <h3>Расчёты</h3>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onClose}
          title="Свернуть панель"
        >
          ✕
        </button>
      </div>

      {methodsError && (
        <div className="banner banner--error">
          Ошибка загрузки методов: {methodsError}
        </div>
      )}

      {/* Выбор метода */}
      <MethodSelector
        methods={methods}
        value={selectedMethodKey}
        onChange={setSelectedMethodKey}
      />

      {selectedMethod && (
        <>
          {/* Маппинг входных кривых */}
          <div className="computations-panel__section">
            <div className="computations-panel__section-title">
              Входные кривые
            </div>
            {selectedMethod.requires.map((role) => (
              <CurveMappingSelect
                key={role}
                role={role}
                availableCurves={availableCurves}
                value={curveMapping[role]}
                onChange={setMapping}
              />
            ))}
          </div>

          {/* Параметры метода */}
          {Object.keys(selectedMethod.params).length > 0 && (
            <div className="computations-panel__section">
              <div className="computations-panel__section-title">
                Параметры метода
              </div>
              {Object.entries(selectedMethod.params).map(([name, meta]) => (
                <ParamSlider
                  key={name}
                  name={name}
                  meta={meta}
                  value={params[name] ?? meta.default}
                  onChange={setParam}
                />
              ))}
            </div>
          )}

          {/* Статус preview */}
          <div className="computations-panel__status">
            {previewLoading && (
              <span className="text-muted text-sm">Расчёт…</span>
            )}
            {previewError && (
              <div className="banner banner--error">{previewError}</div>
            )}
            {!previewLoading && !previewError && previewData && (
              <span className="text-sm text-muted">
                Готово: <strong>{Object.keys(previewData.curves).join(', ')}</strong>
              </span>
            )}
            {!previewLoading && !previewError && previewData && (() => {
              const coverage = Object.entries(previewData.curves).map(([mnemonic, c]) => {
                const total = c.values.length;
                const valid = c.values.filter((v) => v != null && isFinite(v)).length;
                return { mnemonic, valid, total, percent: Math.round((valid / total) * 100) };
              });

              const lowCoverage = coverage.filter((c) => c.percent < 50);
              if (lowCoverage.length === 0) return null;

              return (
                <div className="banner banner--warning" style={{ marginTop: '8px' }}>
                  ⚠️ Мало данных для расчёта:{' '}
                  {lowCoverage.map((c) => `${c.mnemonic} — ${c.percent}%`).join(', ')}
                  <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                    Возможно, входная кривая содержит много пропусков (NaN).
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Предупреждения */}
          {warnings.length > 0 && (
            <div className="computations-panel__warnings">
              {warnings.map((w, i) => (
                <div key={i} className="banner banner--warning">
                  {w}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </aside>
  );
}