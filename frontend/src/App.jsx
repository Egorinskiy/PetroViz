import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useWellList } from './hooks/useWellList';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './api/axiosClient';
import { DEFAULT_SCALE, computePixelWidth } from './constants/depthScales';
import { MAX_CURVES } from './constants/limits';
import { Topbar } from './components/Topbar';
import { CurvesBar } from './components/CurvesBar';
import { CurvesPanel } from './components/CurvesPanel';
import { WellsSidebar } from './components/WellsSidebar';
import { ComputationsPanel } from './components/ComputationsPanel';
import { ResizableSidebar } from './components/ResizableSidebar';
import { FolderIcon, ChartIcon } from './components/Icons';
import { Logo } from './components/Logo';
import WellLogViewer from './components/WellLogViewer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './components/AdminLayout';
import { UserMenu } from './components/UserMenu';
import { ErrorModal } from './components/ErrorModal';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminWellsPage } from './pages/AdminWellsPage';
import { computationsApi } from './api/computations';
import { extractErrorMessage } from './utils/errors';
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  // --- B10: шаг сетки глубин ---
  const [gridStep, setGridStep] = useState(() => {
    const saved = localStorage.getItem('petroviz.gridStep');
    if (!saved || saved === 'auto') return 'auto';
    const n = Number(saved);
    return isFinite(n) ? n : 'auto';
  });

  // --- B6: пользовательский диапазон глубин ---
  const [depthRange, setDepthRange] = useState(null);

  // --- B27: видимость блока кривых ---
  const [curvesVisible, setCurvesVisible] = useState(() => {
    const saved = localStorage.getItem('petroviz.topbar.curvesVisible');
    return saved !== '0';
  });

  // --- Состояние панели расчётов ---
  const [computationsOpen, setComputationsOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [porosityExpress, setPorosityExpress] = useState(null);
  const [fluidZones, setFluidZones] = useState([]);
  const [savedTracks, setSavedTracks] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const debounceRef = useRef(null);

  // --- Загрузка данных выбранной скважины ---
  const fetchCurveData = useCallback(async (wellId, curves, scaleKey) => {
    if (!wellId || curves.length === 0) {
      setWellData(null);
      return;
    }
    setDataLoading(true);
    setDataError(null);
    try {
      const pixelWidth = computePixelWidth(scaleKey);
      const response = await apiClient.get(`/wells/${wellId}/data`, {
        params: {
          curves: curves.join(','),
          mode: 'pixel',
          pixel_width: pixelWidth,
        },
      });
      setWellData(response.data);
    } catch (err) {
      setDataError(extractErrorMessage(err, 'Не удалось загрузить данные скважины'));
    } finally {
      setDataLoading(false);
      setIsInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    if (!activeWellId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCurveData(activeWellId, selectedCurves, scale);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [activeWellId, selectedCurves, scale, fetchCurveData]);

  // --- B27: persist видимости кривых ---
  useEffect(() => {
    localStorage.setItem(
      'petroviz.topbar.curvesVisible',
      curvesVisible ? '1' : '0'
    );
  }, [curvesVisible]);

  // --- B10: persist шага сетки ---
  useEffect(() => {
    localStorage.setItem('petroviz.gridStep', String(gridStep));
  }, [gridStep]);

  const handleToggleCurves = () => setCurvesVisible((v) => !v);

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
    setIsInitialLoad(true);
    setPreviewData(null);
    setPorosityExpress(null);
    setFluidZones([]);
    setSavedTracks([]);
    setDepthRange(null); // B6: сброс кастомного диапазона при смене скважины
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
      setDataError(extractErrorMessage(err, 'Не удалось загрузить файл'));
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
        setDepthRange(null);
      }
      await reload();
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Не удалось удалить скважину'));
    }
  };

  // --- Загрузка сохранённого расчёта на трек ---
  const handleShowSaved = useCallback(async (compId, category) => {
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
            category, // B33: категория для группировки треков
          },
        ];
      });
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Не удалось загрузить расчёт'));
    }
  }, []);

  const handleHideSaved = useCallback((compId) => {
    setSavedTracks((prev) => prev.filter((t) => t.id !== compId));
  }, []);

  // --- Приём данных из экспресс-вкладки ---
  const handleExpressChange = useCallback((data) => {
    // B33: все express-кривые — porosity
    setPorosityExpress(data ? { ...data, category: 'porosity' } : null);
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
        showCurvesButton={!!activeWellId}
        curvesVisible={curvesVisible}
        onToggleCurves={handleToggleCurves}
        wellName={activeWell?.well_name || activeWell?.filename || null}
        showSharedBadge={!!activeWell && !activeWell.is_owner}
        gridStep={gridStep}
        onGridStepChange={setGridStep}
        minDepth={activeWell?.start_depth ?? null}
        maxDepth={activeWell?.stop_depth ?? null}
        depthRange={depthRange}
        onDepthRangeChange={setDepthRange}
      />

      <div className="main-layout">
        <ResizableSidebar
          side="left"
          min={180}
          max={500}
          defaultWidth={260}
          storageKey="petroviz.sidebar.wells"
          title="Скважины"
          icon={<FolderIcon size={22} />}
        >
          <WellsSidebar
            wells={wells}
            loading={wellsLoading}
            activeWellId={activeWellId}
            onSelect={handleSelectWell}
            onDelete={handleDelete}
            reload={reload}
          />
        </ResizableSidebar>

        <div className="main-content">
          {wellsError && (
            <div className="banner banner--error">
              Ошибка загрузки списка: {wellsError}
            </div>
          )}

          {!activeWellId && (
            <div className="welcome-screen">
              <div className="welcome-logo">
                <Logo variant="pv" size={88} />
              </div>
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
              {curvesVisible && (
                <>
                  <CurvesBar selectedCurves={selectedCurves} />

                  {availableCurves.length > 0 && (
                    <CurvesPanel
                      availableCurves={availableCurves}
                      curveUnits={curveUnits}
                      selectedCurves={selectedCurves}
                      onToggle={toggleCurve}
                    />
                  )}
                </>
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
                    gridStep={gridStep}
                    topDepth={depthRange?.top ?? null}
                    bottomDepth={depthRange?.bottom ?? null}
                  />
                  {/* Первая загрузка скважины — полноэкранный overlay */}
                  {dataLoading && isInitialLoad && (
                    <div className="loading-overlay">
                      <div className="progress-bar">
                        <div className="progress-bar-inner" />
                      </div>
                      <p>Загрузка данных…</p>
                    </div>
                  )}

                  {/* Обновление (смена масштаба / кривых) — маленький badge */}
                  {dataLoading && !isInitialLoad && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        zIndex: 5,
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        className="spinner"
                        style={{ width: 10, height: 10 }}
                      />
                      <span>Обновление…</span>
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
          <ResizableSidebar
            side="right"
            min={280}
            max={600}
            defaultWidth={320}
            storageKey="petroviz.sidebar.computations"
            title="Расчёты"
            icon={<ChartIcon size={22} />}
          >
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
          </ResizableSidebar>
        )}
      </div>

      {/* B36: стилизованный диалог ошибки вместо window.alert */}
      <ErrorModal
        message={errorMessage}
        onClose={() => setErrorMessage(null)}
      />
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