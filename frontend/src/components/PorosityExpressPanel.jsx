import React from 'react';
import {
  usePorosityExpress,
  DEFAULT_EXPRESS_PARAMS,
  LITHOLOGY_PRESETS,
} from '../hooks/usePorosityExpress';
import { PorosityCrossplots } from './PorosityCrossplots';
import { PorosityStatistics } from './PorosityStatistics';
import { FluidZonesEditor } from './FluidZonesEditor';

const POROSITY_COLORS = {
  PHID: '#E65100',
  PHIN: '#0277BD',
  PHI_ND: '#00897B',
  PHIS: '#6A1B9A',
};

export function PorosityExpressPanel({ wellId, onResultChange }) {
  const [params, setParams] = React.useState(DEFAULT_EXPRESS_PARAMS);
  const [lithology, setLithology] = React.useState('sandstone');
  const [visible, setVisible] = React.useState({
    PHID: true, PHIN: true, PHI_ND: true, PHIS: true,
  });
  const [subTab, setSubTab] = React.useState('track');
  const [fluidZones, setFluidZones] = React.useState([]);

  const { previewData, loading, error } = usePorosityExpress({
    wellId,
    enabled: !!wellId,
    expressParams: params,
    fluidZones,
  });

  // Границы глубин (для дефолта новых зон)
  const depthRange = React.useMemo(() => {
    const d = previewData?.depth;
    if (!d || d.length === 0) return { min: 0, max: 100 };
    return { min: d[0], max: d[d.length - 1] };
  }, [previewData]);

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
      <div className="computations-panel__section-title">Параметры</div>

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

      {/* --- Зоны флюидов --- */}
      <div className="computations-panel__section-title" style={{ marginTop: 14 }}>
        Зоны флюидов
      </div>
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
              borderBottom: subTab === key ? '2px solid #1565c0' : '2px solid transparent',
              color: subTab === key ? '#1565c0' : '#666',
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
          Расчёт 4 методов…
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
                {Object.entries(previewData.curves).map(([mnemonic]) => {
                  const color = POROSITY_COLORS[mnemonic] || '#666';
                  const checked = isChecked(mnemonic);
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
                      <span style={{ fontWeight: 600, color }}>{mnemonic}</span>
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
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {value.toFixed(decimals)} {unit}
        </span>
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