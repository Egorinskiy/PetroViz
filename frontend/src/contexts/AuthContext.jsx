import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiClient, tokenStorage } from '../api/axiosClient';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);  // true, пока проверяем токен

  // --- Загрузка текущего пользователя ---
  const loadUser = useCallback(async () => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data);
    } catch (err) {
      console.warn('Failed to load user:', err.message);
      tokenStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // При монтировании — пробуем загрузить user
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // --- Login ---
  const login = async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password });
    const { access_token, refresh_token } = response.data;
    tokenStorage.set(access_token, refresh_token);
    await loadUser();
  };

  // --- Register ---
  const register = async (username, email, password, fullName = null) => {
    const response = await apiClient.post('/auth/register', {
      username,
      email,
      password,
      full_name: fullName,
    });
    return response.data;
  };

  // --- Logout ---
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Игнорируем ошибки — токен всё равно удаляем
    }
    tokenStorage.clear();
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout,
    reload: loadUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}