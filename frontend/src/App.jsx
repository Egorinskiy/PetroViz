import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import WellLogViewer from './components/WellLogViewer';
import { isServiceCurve } from './constants/curveFamilies';
import { DEPTH_SCALES, DEFAULT_SCALE } from './constants/depthScales';
import './App.css';

const MAX_CURVES = 8;

function App() {
  const [wellId, setWellId] = useState(null);
  const [wellFileName, setWellFileName] = useState('');
  const [wellData, setWellData] = useState(null);
  const [availableCurves, setAvailableCurves] = useState([]);
  const [curveUnits, setCurveUnits] = useState({});
  const [selectedCurves, setSelectedCurves] = useState([]);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  const { mainCurves, serviceCurves } = useMemo(() => {
    const main = [];
    const service = [];
    availableCurves.forEach((c) => {
      if (isServiceCurve(c)) service.push(c);
      else main.push(c);
    });
    return { mainCurves: main, serviceCurves: service };
  }, [availableCurves]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setWellData(null);
    setWellId(null);
    setAvailableCurves([]);
    setSelectedCurves([]);
    setCurveUnits({});
    setPanelOpen(false);
    setWellFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadResponse = await axios.post('/api/wells/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newWellId = uploadResponse.data.well_id;
      const metadata = uploadResponse.data.metadata;
      setWellId(newWellId);

      const curveNames = metadata.curves.map((c) => c.mnemonic);

      const units = {};
      metadata.curves.forEach((c) => {
        units[c.mnemonic] = c.unit || '';
      });
      setCurveUnits(units);
      setAvailableCurves(curveNames);

      if (curveNames.length === 0) {
        setError('В файле не найдено ни одной кривой');
        return;
      }

      const preferred = ['GR', 'RHOB', 'NPHI', 'DTC'];
      const autoSelected = preferred.filter((p) => curveNames.includes(p));
      const fallback =
        autoSelected.length > 0 ? autoSelected : curveNames.slice(0, 3);

      setSelectedCurves(fallback);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const fetchCurveData = async (id, curves) => {
    if (!id || !curves || curves.length === 0) {
      setWellData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/wells/${id}/data`, {
        params: {
          curves: curves.join(','),
          mode: 'pixel',
          pixel_width: 900,
        },
      });
      setWellData(response.data);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!wellId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCurveData(wellId, selectedCurves);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wellId, selectedCurves]);

  const toggleCurve = (curve) => {
    const isSelected = selectedCurves.includes(curve);
    const wouldExceed = !isSelected && selectedCurves.length >= MAX_CURVES;
    if (wouldExceed) return;

    setLoading(true);
    setSelectedCurves((prev) =>
      isSelected ? prev.filter((c) => c !== curve) : [...prev, curve]
    );
  };

  const renderCurveCheckbox = (curve) => {
    const isSelected = selectedCurves.includes(curve);
    const disabled = !isSelected && selectedCurves.length >= MAX_CURVES;

    const rawUnit = curveUnits[curve] || '';
    const shortMnemonic = curve.length > 6 ? curve.slice(0, 6) : curve;
    const shortUnit = rawUnit.length > 6 ? rawUnit.slice(0, 6) : rawUnit;
    const shortLabel = shortUnit
      ? `${shortMnemonic} [${shortUnit}]`
      : shortMnemonic;
    const fullLabel = rawUnit ? `${curve} [${rawUnit}]` : curve;

    return (
      <label
        key={curve}
        title={fullLabel}
        style={{
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={disabled}
          onChange={() => toggleCurve(curve)}
        />{' '}
        {shortLabel}
      </label>
    );
  };

  return (
    <div className="App">
      {/* === TOPBAR === */}
      <div className="topbar">
        <h1 className="logo">PetroViz</h1>

        <label className="file-upload">
          <input
            type="file"
            accept=".las"
            onChange={handleFileUpload}
          />
          <span className="file-upload-btn">📁 Загрузить LAS</span>
          {wellFileName && <span className="file-upload-name">{wellFileName}</span>}
        </label>

        {wellData && (
          <div className="scale-selector">
            <label>
              Масштаб:{' '}
              <select value={scale} onChange={(e) => setScale(e.target.value)}>
                {Object.keys(DEPTH_SCALES).map((key) => (
                  <option key={key} value={key}>
                    {key === 'full' ? 'Весь интервал' : key}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {/* === CURVES BAR (свёрнутый) === */}
      {wellData && (
        <div className="curves-bar">
          <span className="curves-bar-label">Кривые:</span>
          <span className="curves-bar-list" title={selectedCurves.join(', ')}>
            {selectedCurves.join(', ')}
          </span>
          <span className="curves-bar-count">
            {selectedCurves.length}/{MAX_CURVES}
          </span>
          <button
            className="curves-bar-toggle"
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? 'Свернуть ▲' : 'Изменить ▼'}
          </button>
        </div>
      )}

      {/* === РАЗВЁРНУТАЯ ПАНЕЛЬ === */}
      {panelOpen && availableCurves.length > 0 && (
        <div className="curves-panel">
          <div className="curves-columns">
            {mainCurves.length > 0 && (
              <div className="curves-column">
                <div className="group-header">
                  Основные ({mainCurves.length})
                </div>
                <div className="checkbox-grid">
                  {mainCurves.map(renderCurveCheckbox)}
                </div>
              </div>
            )}

            {serviceCurves.length > 0 && (
              <div className="curves-column">
                <div className="group-header service">
                  Служебные ({serviceCurves.length})
                </div>
                <div className="checkbox-grid">
                  {serviceCurves.map(renderCurveCheckbox)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="error-banner">Ошибка: {error}</div>}

      {/* === ГРАФИК === */}
      {wellData && (
        <div className="chart-wrapper">
          <WellLogViewer
            wellData={wellData}
            curvesToPlot={selectedCurves.filter((c) =>
              Object.prototype.hasOwnProperty.call(wellData, c)
            )}
            units={curveUnits}
            scale={scale}
          />
          {loading && (
            <div className="loading-overlay">
              <div className="progress-bar">
                <div className="progress-bar-inner" />
              </div>
              <p>Обновление данных…</p>
            </div>
          )}
        </div>
      )}

      {loading && !wellData && (
        <div className="initial-loading">Загрузка данных…</div>
      )}
    </div>
  );
}

export default App;