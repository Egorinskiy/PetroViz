import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(
        form.username,
        form.email,
        form.password,
        form.full_name || null
      );
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'Ошибка регистрации';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h2>✅ Регистрация успешна</h2>
          <p>Перенаправляем на страницу входа…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Регистрация</h1>

        {error && <div className="auth-error">{error}</div>}

        <label>
          Имя пользователя *
          <input
            type="text"
            value={form.username}
            onChange={handleChange('username')}
            required
            minLength={3}
            maxLength={64}
            autoFocus
          />
        </label>

        <label>
          Email *
          <input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            required
          />
        </label>

        <label>
          Пароль * (минимум 8 символов)
          <input
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <label>
          Полное имя (опционально)
          <input
            type="text"
            value={form.full_name}
            onChange={handleChange('full_name')}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Создание…' : 'Зарегистрироваться'}
        </button>

        <p className="auth-hint">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}