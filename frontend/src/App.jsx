import React, { useState } from 'react';
import { useWellData } from './hooks/useWellData';
import { DEFAULT_SCALE } from './constants/depthScales';
import { Topbar } from './components/Topbar';
import { CurvesBar } from './components/CurvesBar';
import { CurvesPanel } from './components/CurvesPanel';
import WellLogViewer from './components/WellLogViewer';
import './App.css';

function App() {
  const {
    fileName,
    wellData,
    availableCurves,
    curveUnits,
    selectedCurves,
    loading,
    error,
    uploadFile,
    toggleCurve,
  } = useWellData();

  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="App">
      <Topbar
        fileName={fileName}
        onFileSelect={uploadFile}
        scale={scale}
        onScaleChange={setScale}
        showScale={!!wellData}
      />

      {wellData && (
        <CurvesBar
          selectedCurves={selectedCurves}
          isOpen={panelOpen}
          onToggle={() => setPanelOpen((o) => !o)}
        />
      )}

      {panelOpen && availableCurves.length > 0 && (
        <CurvesPanel
          availableCurves={availableCurves}
          curveUnits={curveUnits}
          selectedCurves={selectedCurves}
          onToggle={toggleCurve}
        />
      )}

      {error && <div className="error-banner">Ошибка: {error}</div>}

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