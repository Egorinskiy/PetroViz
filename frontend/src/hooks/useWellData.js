import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { isServiceCurve } from '../constants/curveFamilies';

const MAX_CURVES = 8;

export function useWellData() {
  const [wellId, setWellId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [wellData, setWellData] = useState(null);
  const [availableCurves, setAvailableCurves] = useState([]);
  const [curveUnits, setCurveUnits] = useState({});
  const [selectedCurves, setSelectedCurves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  // Авто-обновление данных при изменении выбора
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

  async function fetchCurveData(id, curves) {
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
      const detail = err.response?.data?.detail || err.message;
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file) {
    if (!file) return;

    setLoading(true);
    setError(null);
    setWellData(null);
    setWellId(null);
    setAvailableCurves([]);
    setSelectedCurves([]);
    setCurveUnits({});
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadResponse = await axios.post('/api/wells/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newWellId = uploadResponse.data.well_id;
      const metadata = uploadResponse.data.metadata;
      setWellId(newWellId);

      const depthMnemonic = metadata.depth_mnemonic || null;
      const curveNames = metadata.curves
        .map((c) => c.mnemonic)
        .filter(
          (m) => !depthMnemonic || m.toUpperCase() !== depthMnemonic.toUpperCase()
        );

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

      // Автовыбор: GR, RHOB, NPHI, DTC, если есть
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
  }

  function toggleCurve(curve) {
    const isSelected = selectedCurves.includes(curve);
    const wouldExceed = !isSelected && selectedCurves.length >= MAX_CURVES;
    if (wouldExceed) return;

    setLoading(true);
    setSelectedCurves((prev) =>
      isSelected ? prev.filter((c) => c !== curve) : [...prev, curve]
    );
  }

  return {
    // state
    wellId,
    fileName,
    wellData,
    availableCurves,
    curveUnits,
    selectedCurves,
    loading,
    error,
    // actions
    uploadFile,
    toggleCurve,
    clearError: () => setError(null),
  };
}