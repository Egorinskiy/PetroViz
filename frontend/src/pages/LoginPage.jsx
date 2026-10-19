import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Не удалось войти';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* --- Баннер (левая колонка) --- */}
        <aside className="auth-banner">
          <div className="auth-banner-content">
            <div className="auth-banner-logo">
              <Logo variant="icon" size={64} />
            </div>
            <h1 className="auth-banner-title">
              <span className="auth-banner-title-petro">Petro</span>
              <span className="auth-banner-title-viz">Viz</span>
            </h1>
            <p className="auth-banner-slogan">
              Веб-платформа визуализации и петрофизической интерпретации
              данных каротажа скважин
            </p>
            <div className="auth-banner-divider" />
            <ul className="auth-banner-features">
              <li>Загрузка LAS-файлов 1.2 / 2.0</li>
              <li>Vshale, пористость, Sw, NTG, K</li>
              <li>Интерактивные кросс-плоты</li>
            </ul>
          </div>
          <div className="auth-banner-footer">
            PetroViz © 2026 · Академия ТОП
          </div>
        </aside>

        {/* --- Форма (правая колонка) --- */}
        <main className="auth-form-side">
          <form className="auth-form" onSubmit={handleSubmit}>
            <header className="auth-form-header">
              <h2 className="auth-form-title">Вход в систему</h2>
              <p className="auth-form-subtitle">
                Введите учётные данные для доступа к платформе
              </p>
            </header>

            {error && <div className="banner banner--error">{error}</div>}

            <div className="auth-field">
              <label className="label" htmlFor="username">
                Имя пользователя
              </label>
              <input
                id="username"
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="admin"
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="password">
                Пароль
              </label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={loading}
            >
              {loading ? 'Вход…' : 'Войти'}
            </button>

            <p className="auth-hint">
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}