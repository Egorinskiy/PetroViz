import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { UploadIcon, ChartIcon, GlobeIcon, SaveIcon } from './Icons';
import './LandingPage.css'; // Вынесем стили сюда, чтобы не раздувать JSX

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Хедер */}
      <header className="landing-header">
        <Logo variant="full" />
        <div style={{ display: 'flex', gap: '16px' }}>
          <button className="btn btn--ghost" onClick={() => navigate('/login')}>
            Войти
          </button>
          <button className="btn btn--primary" onClick={() => navigate('/register')}>
            Регистрация
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero__content">
          <h1 className="landing-hero__title">
            Веб-платформа для визуализации и интерпретации данных каротажа
          </h1>
          <p className="landing-hero__subtitle">
            Загружайте LAS-файлы, стройте интерактивные планшеты и выполняйте петрофизические расчёты прямо в браузере. Без установки тяжелого ПО.
          </p>
          <div className="landing-hero__actions">
            <button className="btn btn--lg btn--primary" onClick={() => navigate('/login')} style={{ background: '#FFD54F', color: '#1A3D5C', fontWeight: 600 }}>
              Начать работу
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="landing-features">
        <h2 className="landing-section-title">Ключевые возможности</h2>
        <div className="landing-features__grid">

          <div className="landing-card">
            <div className="landing-card__icon"><UploadIcon size={28} color="var(--color-accent-blue)" /></div>
            <h3>Парсинг LAS 1.2 / 2.0</h3>
            <p>Поддержка нестандартных мнемоник, разных кодировок и автодетект семейств кривых.</p>
          </div>

          <div className="landing-card">
            <div className="landing-card__icon"><ChartIcon size={28} color="var(--color-accent-blue)" /></div>
            <h3>Интерактивные планшеты</h3>
            <p>Composite-треки, логарифмические шкалы, зоны флюидов и гибкая настройка масштаба.</p>
          </div>

          <div className="landing-card">
            <div className="landing-card__icon"><GlobeIcon size={28} color="var(--color-accent-blue)" /></div>
            <h3>14 методов петрофизики</h3>
            <p>Расчёт Vshale, пористости, Sw, Swi, NTG и проницаемости с полной воспроизводимостью.</p>
          </div>

          <div className="landing-card">
            <div className="landing-card__icon"><SaveIcon size={28} color="var(--color-accent-blue)" /></div>
            <h3>Экспорт данных</h3>
            <p>Выгрузка результатов в LAS, CSV и векторный PDF-отчёт 1:1 с экраном.</p>
          </div>

        </div>
      </section>

      {/* Для кого */}
      <section className="landing-audience">
        <h2 className="landing-section-title">Для кого этот сервис?</h2>
        <p>
          Платформа создана для геофизиков, петрофизиков и студентов профильных специальностей, которым нужен быстрый и легкий доступ к данным каротажа без развертывания сложных десктопных комплексов.
        </p>
      </section>

      {/* Футер */}
      <footer className="landing-footer">
        <p>© 2026 PetroViz. Дипломный проект Васютинского Егора (Академия ТОП).</p>
        <a href="https://github.com/Egorinskiy/PetroViz" target="_blank" rel="noreferrer">
          Исходный код на GitHub
        </a>
      </footer>
    </div>
  );
}