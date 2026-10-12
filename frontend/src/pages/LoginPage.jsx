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
      <form className="card auth-form" onSubmit={handleSubmit}>
        <div className="auth-logo">
          <Logo variant="full" size={36} />
        </div>

        <h1>Вход</h1>

        {error && <div className="banner banner--error">{error}</div>}

        <div className="auth-field">
          <label className="label" htmlFor="username">Имя пользователя</label>
          <input
            id="username"
            className="input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </div>

        <div className="auth-field">
          <label className="label" htmlFor="password">Пароль</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
    </div>
  );
}