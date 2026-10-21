import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { extractErrorMessage } from '../utils/errors';
import { Logo } from '../components/Logo';

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
      await register(form.username, form.email, form.password, form.full_name || null);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(extractErrorMessage(err, 'Не удалось зарегистрироваться'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-layout auth-layout--narrow">
          <div className="auth-form-side">
            <div className="auth-form">
              <div className="auth-success-icon">✓</div>
              <h2 className="auth-form-title" style={{ textAlign: 'center' }}>
                Регистрация успешна
              </h2>
              <p className="text-muted" style={{ textAlign: 'center' }}>
                Перенаправляем на страницу входа…
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        {/* --- Баннер (левая колонка) --- */}
        <aside className="auth-banner">
          <div className="auth-banner-content">
            <div className="auth-banner-logo">
              <Logo variant="pv" size={72} />
            </div>
            <h1 className="auth-banner-title">
              <span className="auth-banner-title-petro">Petro</span>
              <span className="auth-banner-title-viz">Viz</span>
            </h1>
            <p className="auth-banner-slogan">
              Присоединяйтесь к платформе петрофизической интерпретации
              данных каротажа
            </p>
            <div className="auth-banner-divider" />
            <ul className="auth-banner-features">
              <li>Свои и расшаренные скважины</li>
              <li>Сохранение расчётов в БД</li>
              <li>Роли: viewer / geophysicist / admin</li>
            </ul>
          </div>
          <div className="auth-banner-footer">
            PetroViz © 2026 · Васютинский Егор
          </div>
        </aside>

        {/* --- Форма (правая колонка) --- */}
        <main className="auth-form-side">
          <form className="auth-form" onSubmit={handleSubmit}>
            <header className="auth-form-header">
              <h2 className="auth-form-title">Регистрация</h2>
              <p className="auth-form-subtitle">
                Создайте аккаунт для доступа к платформе
              </p>
            </header>

            {error && <div className="banner banner--error">{error}</div>}

            <div className="auth-field">
              <label className="label" htmlFor="reg-username">
                Имя пользователя <span className="auth-required">*</span>
              </label>
              <input
                id="reg-username"
                className="input"
                type="text"
                value={form.username}
                onChange={handleChange('username')}
                required
                minLength={3}
                maxLength={64}
                autoFocus
                placeholder="username"
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="reg-email">
                Email <span className="auth-required">*</span>
              </label>
              <input
                id="reg-email"
                className="input"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="reg-password">
                Пароль <span className="auth-required">*</span>
                <span className="auth-label-hint">минимум 8 символов</span>
              </label>
              <input
                id="reg-password"
                className="input"
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </div>

            <div className="auth-field">
              <label className="label" htmlFor="reg-fullname">
                Полное имя <span className="auth-label-hint">опционально</span>
              </label>
              <input
                id="reg-fullname"
                className="input"
                type="text"
                value={form.full_name}
                onChange={handleChange('full_name')}
                placeholder="Иван Иванов"
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={loading}
            >
              {loading ? 'Создание…' : 'Зарегистрироваться'}
            </button>

            <p className="auth-hint">
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}