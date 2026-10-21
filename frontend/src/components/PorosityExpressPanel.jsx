import React from 'react';
import {
  usePorosityExpress,
  DEFAULT_EXPRESS_PARAMS,
  LITHOLOGY_PRESETS,
  getExternalColor,
} from '../hooks/usePorosityExpress';
import { PorosityCrossplots } from './PorosityCrossplots';
import { PorosityStatistics } from './PorosityStatistics';
import { FluidZonesEditor } from './FluidZonesEditor';
import { CollapsibleSection } from './CollapsibleSection';

const POROSITY_COLORS = {
  PHID: '#E65100',
  PHIN: '#0277BD',
  PHI_ND: '#00897B',
  PHIS: '#6A1B9A',
};

const BUILTIN_MNEMONICS = ['PHID', 'PHIN', 'PHI_ND', 'PHIS'];

export function PorosityExpressPanel({
  wellId,
  availableCurves = [],
  onResultChange,
  zones = [],
  onZonesChange,
}) {
  const [params, setParams] = React.useState(DEFAULT_EXPRESS_PARAMS);
  const [lithology, setLithology] = React.useState('sandstone');
  const [subTab, setSubTab] = React.useState('track');
  const [externalCurves, setExternalCurves] = React.useState([]);
  // visible — теперь по всем кривым (включая внешние)
  const [visible, setVisible] = React.useState({
    PHID: true, PHIN: true, PHI_ND: true, PHIS: true,
  });

  const fluidZones = zones;
  const setFluidZones = onZonesChange || (() => {});

  const { previewData, loading, error } = usePorosityExpress({
    wellId,
    enabled: !!wellId,
    expressParams: params,
    fluidZones,
    externalCurves,
  });

  const depthRange = React.useMemo(() => {
    const d = previewData?.depth;
    if (!d || d.length === 0) return { min: 0, max: 100 };
    return { min: d[0], max: d[d.length - 1] };
  }, [previewData]);

  // Список для добавления — кривые скважины, которых нет в express
  const addableCurves = React.useMemo(() => {
    const used = new Set([
      ...BUILTIN_MNEMONICS,
      ...externalCurves.map((c) => c.mnemonic),
    ]);
    return (availableCurves || []).filter(
      (c) => c.mnemonic && !used.has(c.mnemonic)
    );
  }, [availableCurves, externalCurves]);

  // Проброс наверх — с учётом видимости
  React.useEffect(() => {
    if (!onResultChange) return;
    if (!previewData) {
      onResultChange(null);
      return;
    }
    const filtered = {
      ...previewData,
      curves: Object.fromEntries(
        Object.entries(previewData.curves).filter(
          ([mnemonic]) => visible[mnemonic] !== false
        )
      ),
    };
    onResultChange(filtered);
  }, [previewData, visible, onResultChange]);

  const handleLithology = (e) => {
    const key = e.target.value;
    setLithology(key);
    if (key !== 'custom' && LITHOLOGY_PRESETS[key]) {
      const preset = LITHOLOGY_PRESETS[key];
      setParams((prev) => ({
        ...prev,
        rho_matrix: preset.rho_matrix,
        dt_matrix: preset.dt_matrix,
      }));
    }
  };

  const handleParam = (name, value) => {
    setParams((prev) => ({ ...prev, [name]: Number(value) }));
    setLithology('custom');
  };

  const toggleVisible = (mnemonic) => {
    setVisible((prev) => ({ ...prev, [mnemonic]: !prev[mnemonic] }));
  };

  const isChecked = (mnemonic) => visible[mnemonic] !== false;

  // --- Внешние кривые ---
  const addExternal = (e) => {
    const mnemonic = e.target.value;
    if (!mnemonic) return;
    const curve = availableCurves.find((c) => c.mnemonic === mnemonic);
    if (!curve) return;
    setExternalCurves((prev) => [
      ...prev,
      { mnemonic: curve.mnemonic, unit: curve.unit },
    ]);
    setVisible((prev) => ({ ...prev, [curve.mnemonic]: true }));
    e.target.value = '';
  };

  const removeExternal = (mnemonic) => {
    setExternalCurves((prev) => prev.filter((c) => c.mnemonic !== mnemonic));
    setVisible((prev) => {
      const next = { ...prev };
      delete next[mnemonic];
      return next;
    });
  };

  // Цвет для кривой (расчётная — из фиксированной палитры, внешняя — из резерва)
  const getCurveColor = (mnemonic) => {
    if (POROSITY_COLORS[mnemonic]) return POROSITY_COLORS[mnemonic];
    const idx = externalCurves.findIndex((c) => c.mnemonic === mnemonic);
    return idx >= 0 ? getExternalColor(idx) : '#666';
  };

  const filteredCurves = React.useMemo(() => {
    if (!previewData) return {};
    return Object.fromEntries(
      Object.entries(previewData.curves).filter(
        ([mnemonic]) => visible[mnemonic] !== false
      )
    );
  }, [previewData, visible]);

  return (
    <div style={{ padding: 12 }}>
      {/* --- Параметры --- */}
      <CollapsibleSection title="Параметры" storageKey="express-params">
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#666', display: 'block' }}>
            Литология матрицы
          </label>
          <select
            className="select"
            value={lithology}
            onChange={handleLithology}
            style={{ width: '100%', fontSize: 12, marginTop: 2 }}
          >
            {Object.entries(LITHOLOGY_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>{p.label}</option>
            ))}
            <option value="custom">Кастомная</option>
          </select>
        </div>

        <ExpressSlider
          name="rho_matrix" label="ρ матрицы" unit="g/cm³"
          min={1.5} max={3.5} step={0.01}
          value={params.rho_matrix} onChange={handleParam}
        />
        <ExpressSlider
          name="rho_fluid" label="ρ флюида (базовое)" unit="g/cm³"
          min={0.1} max={1.5} step={0.05}
          value={params.rho_fluid} onChange={handleParam}
        />
        <ExpressSlider
          name="dt_matrix" label="DT матрицы" unit="µs/ft"
          min={30} max={100} step={0.5}
          value={params.dt_matrix} onChange={handleParam}
        />
        <ExpressSlider
          name="dt_fluid" label="DT флюида" unit="µs/ft"
          min={100} max={700} step={1}
          value={params.dt_fluid} onChange={handleParam}
        />
      </CollapsibleSection>

      {/* --- Зоны флюидов --- */}
      <CollapsibleSection
        title="Зоны флюидов"
        storageKey="express-zones"
        style={{ marginTop: 14 }}
      >
        <div
          className="text-xs text-muted"
          style={{ marginBottom: 6, lineHeight: 1.35 }}
        >
          ρ<sub>f</sub> переопределяется по интервалам глубины (газ/нефть).
        </div>
        <FluidZonesEditor
          zones={fluidZones}
          onChange={setFluidZones}
          minDepth={depthRange.min}
          maxDepth={depthRange.max}
        />
      </CollapsibleSection>

      {/* --- Внешние кривые --- */}
      <CollapsibleSection
        title="Внешние кривые"
        storageKey="express-external"
        style={{ marginTop: 14 }}
      >
        <div
          className="text-xs text-muted"
          style={{ marginBottom: 6, lineHeight: 1.35 }}
        >
          Добавьте кривую из LAS (например, ЯМК) для сравнения с расчётной пористостью.
        </div>

      {externalCurves.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {externalCurves.map((c) => {
            const color = getCurveColor(c.mnemonic);
            const checked = isChecked(c.mnemonic);
            return (
              <div
                key={c.mnemonic}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 4px',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: 12,
                  opacity: checked ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleVisible(c.mnemonic)}
                />
                <span
                  style={{
                    flex: 1,
                    fontWeight: 600,
                    color,
                    borderBottom: '1px dashed ' + color,
                  }}
                  title={`${c.mnemonic}${c.unit ? ', ' + c.unit : ''} (внешняя)`}
                >
                  {c.mnemonic}
                </span>
                <button
                  onClick={() => removeExternal(c.mnemonic)}
                  title="Удалить кривую"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    fontSize: 14,
                    padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {addableCurves.length > 0 ? (
        <select
          className="select"
          defaultValue=""
          onChange={addExternal}
          style={{ width: '100%', fontSize: 12 }}
        >
          <option value="">+ Добавить внешнюю кривую…</option>
          {addableCurves.map((c) => (
            <option key={c.mnemonic} value={c.mnemonic}>
              {c.mnemonic}{c.unit ? ` (${c.unit})` : ''}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-xs text-muted">
          Нет доступных кривых для добавления.
        </div>
      )}
    </CollapsibleSection>

      {/* --- Под-вкладки --- */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginTop: 14,
          marginBottom: 8,
          borderBottom: '1px solid #eee',
        }}
      >
        {[
          ['track', 'Треки'],
          ['crossplot', 'Кросс-плоты'],
          ['stats', 'Статистика'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom:
                subTab === key
                  ? '2px solid var(--color-accent-blue)'
                  : '2px solid transparent',
              color: subTab === key ? 'var(--color-accent-blue)' : '#666',
              fontWeight: subTab === key ? 600 : 400,
              padding: '6px 4px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="banner banner--error">{error}</div>}

      {loading && previewData && (
        <div
          className="text-xs text-muted"
          style={{
            padding: '4px 8px',
            background: '#f0f4f8',
            borderRadius: 4,
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          Обновление…
        </div>
      )}

      {loading && !previewData && (
        <div className="text-sm text-muted" style={{ padding: '8px 0' }}>
          Расчёт…
        </div>
      )}

      {previewData && (
        <>
          {subTab === 'track' && (
            <>
              <div className="computations-panel__section-title">
                Кривые на треке
              </div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                {Object.entries(previewData.curves).map(([mnemonic, curve]) => {
                  const color = getCurveColor(mnemonic);
                  const checked = isChecked(mnemonic);
                  const isExternal = !!curve.isExternal;
                  return (
                    <label
                      key={mnemonic}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 4px',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        opacity: checked ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleVisible(mnemonic)}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          color,
                          borderBottom: isExternal ? `1px dashed ${color}` : 'none',
                        }}
                      >
                        {mnemonic}
                      </span>
                      {isExternal && (
                        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                          внешняя
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {subTab === 'crossplot' && (
            <PorosityCrossplots
              curves={filteredCurves}
              depth={previewData.depth}
            />
          )}

          {subTab === 'stats' && (
            <PorosityStatistics curves={filteredCurves} />
          )}

          {previewData.warnings.length > 0 && (
            <div className="banner banner--warning" style={{ marginTop: 10 }}>
              {previewData.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 11 }}>{w}</div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !previewData && !error && (
        <div className="text-sm text-muted">Нет данных для расчёта.</div>
      )}
    </div>
  );
}

function ExpressSlider({ name, label, unit, min, max, step, value, onChange }) {
  const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#666',
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <EditableNumber
          value={value}
          decimals={decimals}
          unit={unit}
          min={min}
          max={max}
          onCommit={(v) => onChange(name, v)}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function EditableNumber({ value, decimals, unit, min, max, onCommit }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef(null);

  const display = (isFinite(value) ? Number(value) : 0).toFixed(decimals);

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => { setDraft(display); setEditing(true); };
  const commit = () => {
    const num = Number(draft);
    if (Number.isFinite(num)) {
      const clamped = Math.min(Math.max(num, min), max);
      onCommit(clamped);
    }
    setEditing(false);
  };
  const cancel = () => setEditing(false);
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          step={Math.pow(10, -decimals)}
          style={{
            width: 60, fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
            padding: '1px 4px',
            border: '1px solid var(--color-accent-blue)',
            borderRadius: 3,
            textAlign: 'right',
          }}
        />
        {unit && <span style={{ marginLeft: 2 }}>{unit}</span>}
      </span>
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Двойной клик — редактировать"
      style={{
        fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer',
        userSelect: 'none', borderBottom: '1px dashed #ccc',
      }}
    >
      {display} {unit}
    </span>
  );
}