import axios from 'axios';

const API_BASE = '/api';

// --- Хранилище токенов (localStorage) ---
const STORAGE_KEYS = {
  ACCESS: 'petroviz_access_token',
  REFRESH: 'petroviz_refresh_token',
};

export const tokenStorage = {
  getAccess: () => localStorage.getItem(STORAGE_KEYS.ACCESS),
  getRefresh: () => localStorage.getItem(STORAGE_KEYS.REFRESH),
  set: (access, refresh) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS, access);
    localStorage.setItem(STORAGE_KEYS.REFRESH, refresh);
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS);
    localStorage.removeItem(STORAGE_KEYS.REFRESH);
  },
};

// --- Основной клиент ---
export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request interceptor: добавляем access token ---
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: ловим 401, пробуем refresh ---
let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(token) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если это не 401 или уже пытались — выходим
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      tokenStorage.clear();
      return Promise.reject(error);
    }

    // Если refresh уже идёт — ставим запрос в очередь
    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${API_BASE}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const { access_token, refresh_token } = response.data;
      tokenStorage.set(access_token, refresh_token);
      onRefreshed(access_token);
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();
      onRefreshFailed();
      // Редирект на логин — через window.location, т.к. вне React-контекста
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);