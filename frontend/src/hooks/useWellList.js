import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/axiosClient';

export function useWellList() {
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/wells');
      setWells(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { wells, loading, error, reload };
}