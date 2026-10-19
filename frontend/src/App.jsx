import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useWellData } from './hooks/useWellData';
import { useWellList } from './hooks/useWellList';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/axiosClient';
import { DEFAULT_SCALE } from './constants/depthScales';
import { Topbar } from './components/Topbar';
import { CurvesBar } from './components/CurvesBar';
import { CurvesPanel } from './components/CurvesPanel';
import { WellsSidebar } from './components/WellsSidebar';
import { ComputationsPanel } from './components/ComputationsPanel';
import WellLogViewer from './components/WellLogViewer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './components/AdminLayout';
import { UserMenu } from './components/UserMenu';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminWellsPage } from './pages/AdminWellsPage';
import { computationsApi } from './api/computations';
import './App.css';

function MainPage() {
  const { user } = useAuth();
  const { wells, loading: wellsLoading, error: wellsError, reload } = useWellList();

  const [activeWellId, setActiveWellId] = useState(null);
  const [wellData, setWellData] = useState(null);
  const [curveUnits, setCurveUnits] = useState({});
  const [availableCurves, setAvailableCurves] = useState([]);
  const [selectedCurves, setSelectedCurves] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [panelOpen, setPanelOpen] = useState(false);

  // --- Состояние панели расчётов ---
  const [computationsOpen, setComputationsOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [porosityExpress, setPorosityExpress] = useState(null);
  const [fluidZones, setFluidZones] = useState([]);
  const [savedTracks, setSavedTracks] = useState([]);

  const MAX_CURVES = 12;
  const debounceRef = useRef(null);

  // --- Загрузка данных выбранной скважины ---
  const fetchCurveData = useCallback(async (wellId, curves) => {
    if (!wellId || curves.length === 0) {
      setWellData(null);
      return;
    }
    setDataLoading(true);
    setDataError(null);
    try {
      const response = await apiClient.get(`/wells/${wellId}/data`, {
        params: {
          curves: curves.join(','),
          mode: 'pixel',
          pixel_width: 3000,
        },
      });
      setWellData(response.data);
    } catch (err) {
      setDataError(err.response?.data?.detail || err.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWellId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCurveData(activeWellId, selectedCurves);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeWellId, selectedCurves, fetchCurveData]);

  // --- Выбор скважины ---
  const handleSelectWell = (well) => {
    setActiveWellId(well.well_id);
    setAvailableCurves(well.curves.map((c) => c.mnemonic));
    const units = {};
    well.curves.forEach((c) => {
      units[c.mnemonic] = c.unit || '';
    });
    setCurveUnits(units);

    const preferred = ['GR', 'RHOB', 'NPHI', 'DTC'];
    const available = well.curves.map((c) => c.mnemonic);
    const auto = preferred.filter((p) => available.includes(p));
    const fallback = auto.length > 0 ? auto : available.slice(1, 4);
    setSelectedCurves(fallback);

    setWellData(null);
    setPreviewData(null);
    setPorosityExpress(null);
    setFluidZones([]);
    setSavedTracks([]);
  };

  // --- Активная скважина ---
  const activeWell = wells.find((w) => w.well_id === activeWellId) || null;

  // --- Загрузка нового файла ---
  const handleUpload = async (file) => {
    if (!file) return;
    setDataLoading(true);
    setDataError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post('/wells/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await reload();
      const newWellId = response.data.well_id;
      const newWell = {
        well_id: newWellId,
        ...response.data.metadata,
        is_owner: true,
      };
      handleSelectWell(newWell);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setDataError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setDataLoading(false);
    }
  };

  // --- Удаление скважины ---
  const handleDelete = async (well) => {
    try {
      await apiClient.delete(`/wells/${well.well_id}`);
      if (well.well_id === activeWellId) {
        setActiveWellId(null);
        setWellData(null);
        setPreviewData(null);
        setPorosityExpress(null);
        setFluidZones([]);
        setSavedTracks([]);
      }
      await reload();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  };

  // --- Загрузка сохранённого расчёта на трек ---
  const handleShowSaved = useCallback(async (compId) => {
    try {
      const data = await computationsApi.getData(compId);
      setSavedTracks((prev) => {
        if (prev.some((t) => t.id === compId)) return prev;
        return [
          ...prev,
          {
            id: compId,
            mnemonic: data.output_mnemonic,
            label: data.output_mnemonic,
            depth: data.depth,
            values: data.values,
            method: data.method,
          },
        ];
      });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      alert(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
  }, []);

  const handleHideSaved = useCallback((compId) => {
    setSavedTracks((prev) => prev.filter((t) => t.id !== compId));
  }, []);

  // --- Приём данных из экспресс-вкладки ---
  const handleExpressChange = useCallback((data) => {
    setPorosityExpress(data);
  }, []);

  const toggleCurve = (curve) => {
    setSelectedCurves((prev) => {
      if (prev.includes(curve)) return prev.filter((c) => c !== curve);
      if (prev.length >= MAX_CURVES) return prev;
      return [...prev, curve];
    });
  };

  return (
    <>
      <Topbar
        fileName={null}
        onFileSelect={handleUpload}
        scale={scale}
        onScaleChange={setScale}
        showScale={!!wellData}
        rightSlot={<UserMenu />}
        showComputations={!!activeWellId}
        computationsOpen={computationsOpen}
        onToggleComputations={() => setComputationsOpen((o) => !o)}
      />

      <div className="main-layout">
        <WellsSidebar
          wells={wells}
          loading={wellsLoading}
          activeWellId={activeWellId}
          onSelect={handleSelectWell}
          onDelete={handleDelete}
          reload={reload}
        />

        <div className="main-content">
          {wellsError && (
            <div className="banner banner--error">
              Ошибка загрузки списка: {wellsError}
            </div>
          )}

          {!activeWellId && (
            <div className="welcome-screen">
              <h2>Добро пожаловать, {user?.username}!</h2>
              <p>Выберите скважину слева или загрузите новый LAS-файл.</p>
              {wells.length === 0 && (
                <p className="text-muted">
                  У вас пока нет скважин. Начните с загрузки LAS.
                </p>
              )}
            </div>
          )}

          {activeWellId && (
            <>
              <div className="well-header">
                <h2>
                  {activeWell?.well_name || activeWell?.filename}
                </h2>
                {activeWell && !activeWell.is_owner && (
                  <span className="badge badge--shared">🌐 Расшаренная</span>
                )}
              </div>

              <CurvesBar
                selectedCurves={selectedCurves}
                isOpen={panelOpen}
                onToggle={() => setPanelOpen((o) => !o)}
              />

              {panelOpen && availableCurves.length > 0 && (
                <CurvesPanel
                  availableCurves={availableCurves}
                  curveUnits={curveUnits}
                  selectedCurves={selectedCurves}
                  onToggle={toggleCurve}
                />
              )}

              {dataError && (
                <div className="banner banner--error">Ошибка: {dataError}</div>
              )}

              {wellData && (
                <div className="chart-wrapper">
                  <WellLogViewer
                    wellData={wellData}
                    curvesToPlot={selectedCurves.filter((c) =>
                      Object.prototype.hasOwnProperty.call(wellData, c)
                    )}
                    units={curveUnits}
                    scale={scale}
                    previewData={previewData}
                    porosityExpress={porosityExpress}
                    fluidZones={fluidZones}
                    savedTracks={savedTracks}
                  />
                  {dataLoading && (
                    <div className="loading-overlay">
                      <div className="progress-bar">
                        <div className="progress-bar-inner" />
                      </div>
                      <p>Обновление данных…</p>
                    </div>
                  )}
                </div>
              )}

              {dataLoading && !wellData && (
                <div className="initial-loading">Загрузка данных…</div>
              )}
            </>
          )}
        </div>

        {/* --- Панель расчётов (боковая) --- */}
        {computationsOpen && (
          <ComputationsPanel
            well={activeWell}
            onPreviewChange={setPreviewData}
            onExpressChange={handleExpressChange}
            zones={fluidZones}
            onZonesChange={setFluidZones}
            onClose={() => setComputationsOpen(false)}
            savedTracks={savedTracks}
            onShowSaved={handleShowSaved}
            onHideSaved={handleHideSaved}
          />
        )}
      </div>
    </>
  );
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* --- Админка --- */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="wells" element={<AdminWellsPage />} />
        </Route>

        {/* --- Главная (защищённая) --- */}
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