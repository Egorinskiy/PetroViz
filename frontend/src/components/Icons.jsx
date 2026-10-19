import React from 'react';

/**
 * Набор минималистичных SVG-иконок (16×16, stroke, currentColor).
 * Наследуют цвет текста — работают на светлых и тёмных кнопках.
 */

export function UploadIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Стрелка вверх */}
      <path
        d="M8 10V2.5M8 2.5L5 5.5M8 2.5L11 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Лоток/коробка */}
      <path
        d="M2.5 10.5V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V10.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChartIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Столбики */}
      <path
        d="M2.5 13V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 13V5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.5 13V7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 13V2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FolderIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 4C2 3.45 2.45 3 3 3H6L7.5 4.5H13C13.55 4.5 14 4.95 14 5.5V12C14 12.55 13.55 13 13 13H3C2.45 13 2 12.55 2 12V4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlobeIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="8" cy="8" rx="2.5" ry="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TrashIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.5 5H12.5M6.5 5V3.5C6.5 3.22 6.72 3 7 3H9C9.28 3 9.5 3.22 9.5 3.5V5M5 5V12.5C5 13.05 5.45 13.5 6 13.5H10C10.55 13.5 11 13.05 11 12.5V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M1.5 8C3 5 5.5 3 8 3C10.5 3 13 5 14.5 8C13 11 10.5 13 8 13C5.5 13 3 11 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeOffIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M2 2L14 14M6.5 6.5C6.2 6.8 6 7.4 6 8C6 9.1 6.9 10 8 10C8.6 10 9.2 9.8 9.5 9.5M3 5C2.2 5.9 1.7 6.9 1.5 8C3 11 5.5 13 8 13C9.3 13 10.7 12.5 11.8 11.7M13 10C13.6 9.4 14.1 8.7 14.5 8C13 5 10.5 3 8 3C7.3 3 6.7 3.1 6 3.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Корпус дискеты */}
      <path
        d="M3 2.5H10.5L13.5 5.5V13C13.5 13.28 13.28 13.5 13 13.5H3C2.72 13.5 2.5 13.28 2.5 13V3C2.5 2.72 2.72 2.5 3 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Верхняя «шторка» */}
      <path
        d="M5 2.5V6H11V2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Нижняя полоса */}
      <path
        d="M4.5 10.5H11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CurvesIcon({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M1.5 3.5 Q3.5 2, 5.5 3.5 T9.5 3.5 T13.5 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M1.5 8 Q3.5 6.5, 5.5 8 T9.5 8 T13.5 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M1.5 12.5 Q3.5 11, 5.5 12.5 T9.5 12.5 T13.5 12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}