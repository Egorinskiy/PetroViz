import React from 'react';

/**
 * Универсальный слайдер параметра.
 *
 * Поддерживает:
 * - линейную шкалу (по умолчанию)
 * - логарифмическую шкалу (meta.scale === "log")
 * - кастомное имя (meta.label)
 */
export function ParamSlider({ name, meta, value, onChange }) {
  const isLog = meta.scale === 'log';
  const displayLabel = meta.label || name;
  const unit = meta.unit || '';
  const min = meta.min;
  const max = meta.max;
  const step = meta.step;
  const decimals =
  step >= 1 ? 0
  : step >= 0.1 ? 1
  : step >= 0.01 ? 2
  : step >= 0.001 ? 3
  : 4;

  // Для лог-шкалы используем виртуальный слайдер 0..100
  const LOG_STEPS = 1000;
  const toSlider = (v) => {
    if (!isLog) return v;
    const safe = Math.max(Number(v), min);
    return (Math.log(safe / min) / Math.log(max / min)) * LOG_STEPS;
  };
  const fromSlider = (s) => {
    if (!isLog) return Number(s);
    return min * Math.pow(max / min, s / LOG_STEPS);
  };

  const handleChange = (e) => {
    const raw = Number(e.target.value);
    const real = isLog ? fromSlider(raw) : raw;
    onChange(name, real);
  };

  const sliderValue = isLog ? toSlider(value ?? meta.default) : (value ?? meta.default);

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#666',
          marginBottom: 2,
        }}
      >
        <span title={meta.description || ''}>{displayLabel}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
          {(value ?? meta.default).toFixed(decimals)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={isLog ? 0 : min}
        max={isLog ? LOG_STEPS : max}
        step={isLog ? 1 : step}
        value={sliderValue}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
    </div>
  );
}