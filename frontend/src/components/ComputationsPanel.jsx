import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useComputePreview } from '../hooks/useComputePreview';
import { useSavedComputations } from '../hooks/useSavedComputations';
import { MethodSelector } from './MethodSelector';
import { ParamSlider } from './ParamSlider';
import { CurveMappingSelect } from './CurveMappingSelect';
import { PorosityExpressPanel } from './PorosityExpressPanel';
import { SourceSelector } from './SourceSelector';
import { EyeIcon, EyeOffIcon, TrashIcon, SaveIcon } from './Icons';
import { SaveComputationModal } from './SaveComputationModal';
import { AllComputationsModal } from './AllComputationsModal';
import { ConfirmDialog } from './ConfirmDialog';

export function ComputationsPanel({
  well,
  onPreviewChange,
  onExpressChange,
  zones = [],
  onZonesChange,
  onClose,
  savedTracks = [],
  onShowSaved,
  onHideSaved,
}) {
  const wellId = well?.well_id || null;
  const availableCurves = well?.curves || [];

  const { user } = useAuth();
  const canCompute =
    user && (user.role === 'admin' || user.role === 'geophysicist');
  const canDeleteItem = (item) => {
    if (!user) return false;
    if (user.role === 'viewer') return false; // viewer строго read-only
    if (user.role === 'admin') return true;
    return item.user_id === user.id;
  };

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
    computationRefs,
    setComputationRef,
    missingRefs,
    refsIncomplete,
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

  // Модалки B3
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [allModalOpen, setAllModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const COMPACT_LIMIT = 5;

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

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month} ${hh}:${mm}`;
  };

   // Открыть модалку сохранения
  const handleOpenSaveModal = () => {
    if (!wellId || !selectedMethodKey || !previewData) return;
    setSaveError(null);
    setSaveModalOpen(true);
  };

  // Фактическое сохранение из модалки
  const handleConfirmSave = async (customName) => {
    if (!wellId || !selectedMethodKey || !previewData) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveComputation({
        method: selectedMethodKey,
        curve_mapping: curveMapping,
        params,
        computation_refs: computationRefs,
        output_mnemonic: customName,
      });
      setSaveModalOpen(false);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setSaveError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSaving(false);
    }
  };

  // Имя по умолчанию для модалки
  const defaultSaveName =
    previewData && Object.keys(previewData.curves).length > 0
      ? Object.keys(previewData.curves)[0]
      : '';

  // Удаление через ConfirmDialog
  const handleRequestDelete = (item) => {
    setDeleteTarget({
      id: item.id,
      name: item.output_mnemonic,
      onTrack: isSavedOnTrack(item.id),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeComputation(deleteTarget.id);
      if (deleteTarget.onTrack && onHideSaved) {
        onHideSaved(deleteTarget.id);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setSaveError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setDeleteTarget(null);
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
      {/* ============ Заголовок ============ */}
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

      {/* ============ Табы ============ */}
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
          {/* Выбор метода — всегда */}
          <MethodSelector
            methods={methods}
            value={selectedMethodKey}
            onChange={setSelectedMethodKey}
          />

          {/* Всё, что зависит от выбранного метода */}
          {selectedMethod && (
            <>
              {/* Источники данных (сохранённые расчёты — refs) */}
              {selectedMethod.requires_computations &&
                Object.keys(selectedMethod.requires_computations).length > 0 && (
                  <div className="computations-panel__section">
                    <div className="computations-panel__section-title">
                      Источники данных
                    </div>
                    {Object.entries(selectedMethod.requires_computations).map(
                      ([role, req]) => (
                        <SourceSelector
                          key={role}
                          role={role}
                          requirement={req}
                          savedItems={savedItems}
                          methods={methods}
                          value={computationRefs[role]}
                          onChange={(id) => setComputationRef(role, id)}
                        />
                      )
                    )}
                  </div>
                )}

              {/* Входные кривые из LAS */}
              {selectedMethod.requires.length > 0 && (
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
              )}

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

              {/* Статус + Кнопка Сохранить */}
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
                  {refsIncomplete && (
                    <div
                      className="banner banner--warning"
                      style={{ marginBottom: 6 }}
                    >
                      ! Выберите источники:{' '}
                      {missingRefs.map((r) => r.label).join(', ')}
                    </div>
                  )}
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
                        ! Мало данных для расчёта:{' '}
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

                <span
                  title={
                    !canCompute
                      ? 'Требуется роль geophysicist'
                      : refsIncomplete
                      ? `Выберите: ${missingRefs.map((r) => r.label).join(', ')}`
                      : !previewData
                      ? 'Сначала дождитесь расчёта'
                      : 'Сохранить расчёт в БД'
                  }
                  style={{ display: 'block', width: '100%' }}
                >
                  <button
                    className="btn btn--primary"
                    onClick={handleOpenSaveModal}
                    disabled={saving || !previewData || refsIncomplete || !canCompute}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      flexShrink: 0,
                      cursor: !canCompute ? 'not-allowed' : undefined,
                    }}
                  >
                    {saving ? (
                      'Сохранение…'
                    ) : (
                      <>
                        <SaveIcon size={16} />
                        <span>Сохранить расчёт</span>
                      </>
                    )}
                  </button>
                </span>

                {saveError && (
                  <div className="banner banner--error">{saveError}</div>
                )}
              </div>

              {/* Предупреждения preview */}
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

          {/* ============ СОХРАНЁННЫЕ РАСЧЁТЫ — компактно ============ */}
          <div className="computations-panel__section" style={{ marginTop: 20 }}>
            <div
              className="computations-panel__section-title"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                Сохранённые{' '}
                {savedItems.length > 0 && `(${savedItems.length})`}
              </span>
              {savedItems.length > COMPACT_LIMIT && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setAllModalOpen(true)}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                >
                  Все →
                </button>
              )}
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

            {savedItems.slice(0, COMPACT_LIMIT).map((item) => {
              const onTrack = isSavedOnTrack(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 2px',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {item.output_mnemonic}
                      {item.warnings?.length > 0 && ' !'}
                    </div>
                    <div
                      className="text-xs text-muted"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.method} · {formatDate(item.created_at)}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    title={onTrack ? 'Скрыть с трека' : 'Показать на треке'}
                    onClick={() =>
                      onTrack ? onHideSaved(item.id) : onShowSaved(item.id)
                    }
                    style={{ padding: '4px 6px' }}
                  >
                    {onTrack ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                  </button>
                  <span
                    title={
                      !canDeleteItem(item)
                        ? user?.role === 'viewer'
                          ? 'Требуется роль geophysicist'
                          : 'Удаление доступно только автору'
                        : 'Удалить'
                    }
                    style={{ display: 'inline-block' }}
                  >
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={!canDeleteItem(item)}
                      onClick={() => handleRequestDelete(item)}
                      style={{
                        padding: '4px 6px',
                        cursor: !canDeleteItem(item) ? 'not-allowed' : undefined,
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </span>
                </div>
              );
            })}

            {savedItems.length > COMPACT_LIMIT && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setAllModalOpen(true)}
                style={{
                  width: '100%',
                  fontSize: 11,
                  padding: '4px 6px',
                  marginTop: 6,
                  color: 'var(--color-accent-blue)',
                }}
              >
                Ещё {savedItems.length - COMPACT_LIMIT} · Показать все
              </button>
            )}
          </div>
        </>
      )}

      {/* ================== ВКЛАДКА «ЭКСПРЕСС-ПОРИСТОСТЬ» ================== */}
      {activeTab === 'porosity' && (
        <PorosityExpressPanel
          wellId={wellId}
          availableCurves={availableCurves}
          onResultChange={setExpressData}
          zones={zones}
          onZonesChange={onZonesChange}
        />
      )}

      {/* ================== МОДАЛКИ (B3) ================== */}
      {saveModalOpen && (
        <SaveComputationModal
          defaultName={defaultSaveName}
          method={selectedMethodKey}
          saving={saving}
          error={saveError}
          onCancel={() => !saving && setSaveModalOpen(false)}
          onConfirm={handleConfirmSave}
        />
      )}

      {allModalOpen && (
        <AllComputationsModal
          items={savedItems}
          savedTracks={savedTracks}
          onShow={onShowSaved}
          onHide={onHideSaved}
          onRemove={async (id) => {
            try {
              await removeComputation(id);
            } catch (err) {
              throw err;
            }
          }}
          onClose={() => setAllModalOpen(false)}
          canDelete={canDeleteItem}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Удалить расчёт?"
          message={
            <div>
              <p style={{ margin: 0 }}>
                Удалить расчёт <strong>«{deleteTarget.name}»</strong>?
              </p>
              <p
                className="text-xs text-muted"
                style={{ margin: '8px 0 0' }}
              >
                Действие необратимо — данные в parquet-файле будут потеряны.
              </p>
            </div>
          }
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </aside>
  );
}