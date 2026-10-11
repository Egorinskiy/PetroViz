import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useWellData } from './hooks/useWellData';
import { DEFAULT_SCALE } from './constants/depthScales';
import { Topbar } from './components/Topbar';
import { CurvesBar } from './components/CurvesBar';
import { CurvesPanel } from './components/CurvesPanel';
import WellLogViewer from './components/WellLogViewer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UserMenu } from './components/UserMenu';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import './App.css';

function MainPage() {
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
    <>
      <Topbar
        fileName={fileName}
        onFileSelect={uploadFile}
        scale={scale}
        onScaleChange={setScale}
        showScale={!!wellData}
        rightSlot={<UserMenu />}
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
    </>
  );
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;