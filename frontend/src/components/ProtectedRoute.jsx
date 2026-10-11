import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Загрузка…
      </div>
    );
  }

  if (!isAuthenticated) {
    // Запоминаем, откуда пришёл — чтобы вернуть после логина
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#c62828' }}>
        <h2>403 — Доступ запрещён</h2>
        <p>Эта страница доступна только администраторам.</p>
      </div>
    );
  }

  return children;
}