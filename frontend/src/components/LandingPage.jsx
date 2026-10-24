import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { UploadIcon, ChartIcon, SaveIcon, GlobeIcon } from './Icons';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'var(--font-sans)' }}>
      {/* Хедер */}
      <header style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderBottom: '1px solid #eaeaea' }}>
        <Logo variant="text" />
        <button className="btn btn--primary" onClick={() => navigate('/login')}>
          Войти в систему
        </button>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '80px 20px', textAlign: 'center', background: 'linear-gradient(135deg, #1A3D5C 0%, #8B2520 100%)', color: '#fff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.2 }}>
            Веб-платформа для интерпретации данных каротажа
          </h1>
          <p style={{ fontSize: '20px', opacity: 0.9, marginBottom: '40px', lineHeight: 1.5 }}>
            Загружайте LAS-файлы, визуализируйте кривые и выполняйте петрофизические расчёты прямо в браузере. Без установки тяжелого ПО.
          </p>
          <button className="btn btn--primary btn--lg" onClick={() => navigate('/login')} style={{ background: '#FFD54F', color: '#1A3D5C', fontWeight: 600, fontSize: '18px', padding: '12px 32px' }}>
            Начать работу
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '32px', marginBottom: '60px', color: '#1A3D5C' }}>
          Ключевые возможности
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>

          <div style={{ padding: '30px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <UploadIcon size={32} color="#2C5282" />
            <h3 style={{ fontSize: '20px', margin: '15px 0 10px', color: '#222' }}>Парсинг LAS 1.2 / 2.0</h3>
            <p style={{ color: '#666', lineHeight: 1.6 }}>Поддержка нестандартных мнемоник, разных кодировок и автодетект семейств кривых.</p>
          </div>

          <div style={{ padding: '30px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <ChartIcon size={32} color="#2C5282" />
            <h3 style={{ fontSize: '20px', margin: '15px 0 10px', color: '#222' }}>Интерактивные планшеты</h3>
            <p style={{ color: '#666', lineHeight: 1.6 }}>Composite-треки, логарифмические шкалы, зоны флюидов и настройка масштаба глубины.</p>
          </div>

          <div style={{ padding: '30px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <GlobeIcon size={32} color="#2C5282" />
            <h3 style={{ fontSize: '20px', margin: '15px 0 10px', color: '#222' }}>14 методов петрофизики</h3>
            <p style={{ color: '#666', lineHeight: 1.6 }}>Расчёт Vshale, пористости, Sw, Swi, NTG и проницаемости с полной воспроизводимостью.</p>
          </div>

          <div style={{ padding: '30px', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <SaveIcon size={32} color="#2C5282" />
            <h3 style={{ fontSize: '20px', margin: '15px 0 10px', color: '#222' }}>Экспорт данных</h3>
            <p style={{ color: '#666', lineHeight: 1.6 }}>Выгрузка результатов в LAS, CSV и векторный PDF-отчёт 1:1 с планшетом.</p>
          </div>

        </div>
      </section>

      {/* Для кого */}
      <section style={{ padding: '60px 20px', background: '#eaf0f6', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', marginBottom: '20px', color: '#1A3D5C' }}>Для кого этот сервис?</h2>
        <p style={{ fontSize: '18px', color: '#444', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
          Платформа создана для геофизиков, петрофизиков и студентов профильных специальностей, которым нужен быстрый и легкий доступ к данным каротажа без развертывания сложных десктопных комплексов.
        </p>
      </section>

      {/* Футер */}
      <footer style={{ padding: '40px', background: '#1A3D5C', color: '#fff', textAlign: 'center' }}>
        <p>© 2026 PetroViz. Дипломный проект Васютинского Егора (Академия ТОП).</p>
        <a href="https://github.com/Egorinskiy/PetroViz" target="_blank" rel="noreferrer" style={{ color: '#FFD54F', textDecoration: 'none', marginTop: '10px', display: 'inline-block' }}>
          Исходный код на GitHub
        </a>
      </footer>
    </div>
  );
}