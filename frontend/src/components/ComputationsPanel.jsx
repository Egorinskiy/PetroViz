import React, { useState } from 'react';
import { useComputePreview } from '../hooks/useComputePreview';
import { useSavedComputations } from '../hooks/useSavedComputations';
import { MethodSelector } from './MethodSelector';
import { ParamSlider } from './ParamSlider';
import { CurveMappingSelect } from './CurveMappingSelect';
import { PorosityExpressPanel } from './PorosityExpressPanel';

export function ComputationsPanel({
  well,
  onPreviewChange,
  onExpressChange,
  onClose,
  savedTracks = [],
  onShowSaved,
  onHideSaved,
}) {
  const wellId = well?.well_id || null;
  const availableCurves = well?.curves || [];

  const [activeTab, setActiveTab] = useState('single');
  const [expressData, setExpressData] = useState(null);

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

  const {
    items: savedItems,
    loading: savedLoading,
    error: savedError,
    save: saveComputation,
    remove: removeComputation,
  } = useSavedComputations({ wellId, enabled: !!wellId });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Проброс Single-таба
  React.useEffect(() => {
    if (!onPreviewChange) return;
    onPreviewChange(activeTab === 'single' ? previewData : null);
  }, [activeTab, previewData, onPreviewChange]);

  // Проброс Express-таба
  React.useEffect(() => {
    if (!onExpressChange) return;
    onExpressChange(activeTab === 'porosity' ? expressData : null);
  }, [activeTab, expressData, onExpressChange]);

  const handleSave = async () => {
    if (!wellId || !selectedMethodKey || !previewData) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveComputation({
        method: selectedMethodKey,
        curve_mapping: curveMapping,
        params,
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setSaveError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSaving(false);
    }
  };

  const isSavedOnTrack = (compId) => savedTracks.some((t) => t.id === compId);

  // --- Заглушка: скважина не выбрана ---
  if (!wellId) {
    return (
      <aside className="computations-panel">
        <div className="computations-panel__header">
          <h3>Расчёты</h3>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>✕</button>
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 20 }}>
          Выберите скважину слева, чтобы начать расчёт.
        </p>
      </aside>
    );
  }

  return (
    <aside className="computations-panel">
      {/* Заголовок */}
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

      {/* Вкладки */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '4px 12px 8px',
          borderBottom: '1px solid #eee',
        }}
      >
        <button
          className={`btn btn--sm ${activeTab === 'single' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('single')}
          style={{ flex: 1 }}
        >
          Одиночный
        </button>
        <button
          className={`btn btn--sm ${activeTab === 'porosity' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setActiveTab('porosity')}
          style={{ flex: 1 }}
        >
          Экспресс-пористость
        </button>
      </div>

      {methodsError && (
        <div className="banner banner--error">
          Ошибка загрузки методов: {methodsError}
        </div>
      )}

      {/* ================== ВКЛАДКА «ОДИНОЧНЫЙ» ================== */}
      {activeTab === 'single' && (
        <>
          <MethodSelector
            methods={methods}
            value={selectedMethodKey}
            onChange={setSelectedMethodKey}
          />

          {selectedMethod && (
            <>
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

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 16,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div
                  className="computations-panel__status"
                  style={{ position: 'static', flexShrink: 0, overflow: 'visible' }}
                >
                  {previewLoading && (
                    <span className="text-muted text-sm">Расчёт…</span>
                  )}
                  {previewError && (
                    <div className="banner banner--error">{previewError}</div>
                  )}
                  {!previewLoading && !previewError && previewData && (
                    <span className="text-sm text-muted">
                      Готово:{' '}
                      <strong>{Object.keys(previewData.curves).join(', ')}</strong>
                    </span>
                  )}

                  {!previewLoading && !previewError && previewData && (() => {
                    const coverage = Object.entries(previewData.curves).map(
                      ([mnemonic, c]) => {
                        const total = c.values.length;
                        const valid = c.values.filter(
                          (v) => v != null && isFinite(v)
                        ).length;
                        return {
                          mnemonic,
                          percent: Math.round((valid / total) * 100),
                        };
                      }
                    );
                    const lowCoverage = coverage.filter((c) => c.percent < 50);
                    if (lowCoverage.length === 0) return null;
                    return (
                      <div
                        className="banner banner--warning"
                        style={{
                          marginTop: 8,
                          position: 'static',
                          height: 'auto',
                          maxHeight: 'none',
                          overflow: 'visible',
                        }}
                      >
                        ⚠️ Мало данных для расчёта:{' '}
                        {lowCoverage
                          .map((c) => `${c.mnemonic} — ${c.percent}%`)
                          .join(', ')}
                        <div
                          className="text-xs text-muted"
                          style={{ marginTop: 4 }}
                        >
                          Возможно, входная кривая содержит много пропусков (NaN).
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button
                  className="btn btn--primary"
                  onClick={handleSave}
                  disabled={saving || !previewData}
                  title={
                    !previewData
                      ? 'Сначала дождитесь расчёта'
                      : 'Сохранить расчёт в БД'
                  }
                  style={{ width: '100%', display: 'block', flexShrink: 0 }}
                >
                  {saving ? 'Сохранение…' : '💾 Сохранить расчёт'}
                </button>

                {saveError && (
                  <div className="banner banner--error">{saveError}</div>
                )}
              </div>

              {/* Список сохранённых */}
              <div className="computations-panel__section" style={{ marginTop: 20 }}>
                <div className="computations-panel__section-title">
                  Сохранённые расчёты{' '}
                  {savedItems.length > 0 && `(${savedItems.length})`}
                </div>

                {savedError && (
                  <div className="banner banner--error">{savedError}</div>
                )}

                {savedLoading && (
                  <div className="text-sm text-muted">Загрузка…</div>
                )}

                {!savedLoading && savedItems.length === 0 && (
                  <div className="text-xs text-muted">
                    Пока ничего не сохранено.
                  </div>
                )}

                {savedItems.map((item) => {
                  const onTrack = isSavedOnTrack(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 4px',
                        borderBottom: '1px solid #eee',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {item.output_mnemonic}
                          {item.warnings?.length > 0 && ' ⚠️'}
                        </div>
                        <div
                          className="text-xs text-muted"
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.method} · {item.num_samples} т.
                        </div>
                      </div>
                      <button
                        className="btn btn--ghost btn--sm"
                        title={onTrack ? 'Скрыть с трека' : 'Показать на треке'}
                        onClick={() =>
                          onTrack ? onHideSaved(item.id) : onShowSaved(item.id)
                        }
                      >
                        {onTrack ? '🚫' : '👁'}
                      </button>
                      <button
                        className="btn btn--ghost btn--sm"
                        title="Удалить"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Удалить расчёт «${item.output_mnemonic}»?`
                            )
                          ) {
                            removeComputation(item.id);
                            if (onTrack) onHideSaved(item.id);
                          }
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  );
                })}
              </div>

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
        </>
      )}

      {/* ================== ВКЛАДКА «ЭКСПРЕСС-ПОРИСТОСТЬ» ================== */}
      {activeTab === 'porosity' && (
        <PorosityExpressPanel
          wellId={wellId}
          onResultChange={setExpressData}
        />
      )}
    </aside>
  );
}