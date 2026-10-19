import React from 'react';

// --- Палитра (синхронизирована с design/tokens.css) ---
const NAVY = '#1A3D5C';
const RED = '#C62828';
const RED_DARK = '#B71C1C';
const YELLOW = '#FFD54F';

export function Logo({ variant = 'full', size = 24, className = '' }) {
  switch (variant) {
    case 'icon':
      return <IconCrossover size={size} className={className} />;
    case 'pv':
      return <IconPV size={size} className={className} />;
    case 'mono':
      return <IconMono size={size} className={className} />;
    case 'text':
      return <TextOnly size={size} className={className} />;
    case 'full':
    default:
      return <FullLogo size={size} className={className} />;
  }
}

// ============================================================================
// Full logo: SVG-иконка + HTML-текст (контролируемый размер)
// ============================================================================

function FullLogo({ size = 24, className = '' }) {
  const iconSize = Math.round(size * 1.15);
  const gap = Math.round(size * 0.3);

  return (
    <div
      className={`logo-full ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap}px`,
        lineHeight: 1,
      }}
    >
      <IconPV size={iconSize} />
      <span
        className="logo-full-text"
        style={{
          fontFamily: "'Geist Sans', system-ui, -apple-system, sans-serif",
          fontSize: `${size}px`,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: RED_DARK }}>Petro</span>
        <span style={{ color: NAVY }}>Viz</span>
      </span>
    </div>
  );
}

// ============================================================================
// Иконки (только SVG)
// ============================================================================

function IconCrossover({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PetroViz"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M 32 19 L 26 22 L 22 25 L 19 28 L 17 32 L 19 36 L 22 39 L 26 42 L 32 45
           L 38 42 L 42 39 L 45 35 L 46 31 L 44 28 L 41 25 L 37 22 Z"
        fill={YELLOW}
      />
      <path
        d="M 40 4 L 38 7 L 41 10 L 37 13 L 39 15 L 34 17 L 32 19
           L 26 22 L 22 25 L 19 28 L 17 32 L 19 36 L 22 39 L 26 42 L 32 45
           L 35 48 L 33 51 L 37 54 L 34 57 L 36 60"
        stroke={RED}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 24 5 Q 26 8, 25 11 Q 28 13, 27 16 L 32 19
           L 38 22 L 41 25 L 44 28 L 46 31 L 45 35 L 42 39 L 38 42 L 32 45
           L 30 49 L 27 52 L 29 55 L 26 58 L 28 60"
        stroke={NAVY}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPV({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PetroViz"
    >
      <path
        d="M 12 10 L 12 54 L 20 54 L 20 44 L 34 44 Q 48 44, 48 27 Q 48 10, 34 10 L 12 10 Z"
        fill={NAVY}
      />
      <rect x="20" y="18" width="18" height="18" fill="#FFFFFF" />
      <path
        d="M 36 10 L 44 54 L 52 54 L 60 10 L 52 10 L 48 38 L 44 10 Z"
        fill={RED}
      />
    </svg>
  );
}

function IconMono({ size = 28, className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PetroViz"
    >
      <path
        d="M 32 19 L 26 22 L 22 25 L 19 28 L 17 32 L 19 36 L 22 39 L 26 42 L 32 45
           L 38 42 L 42 39 L 45 35 L 46 31 L 44 28 L 41 25 L 37 22 Z"
        fill="#1A1A1A"
        fillOpacity="0.2"
      />
      <path
        d="M 40 4 L 38 7 L 41 10 L 37 13 L 39 15 L 34 17 L 32 19
           L 26 22 L 22 25 L 19 28 L 17 32 L 19 36 L 22 39 L 26 42 L 32 45
           L 35 48 L 33 51 L 37 54 L 34 57 L 36 60"
        stroke="#1A1A1A"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 24 5 Q 26 8, 25 11 Q 28 13, 27 16 L 32 19
           L 38 22 L 41 25 L 44 28 L 46 31 L 45 35 L 42 39 L 38 42 L 32 45
           L 30 49 L 27 52 L 29 55 L 26 58 L 28 60"
        stroke="#1A1A1A"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextOnly({ size = 24, className = '' }) {
  return (
    <span
      className={`logo-text ${className}`}
      style={{
        fontFamily: "'Geist Sans', system-ui, -apple-system, sans-serif",
        fontSize: `${size}px`,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: RED_DARK }}>Petro</span>
      <span style={{ color: NAVY }}>Viz</span>
    </span>
  );
}