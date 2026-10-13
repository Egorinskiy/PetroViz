import React from 'react';

export function ParamSlider({ name, meta, value, onChange }) {
  const displayValue =
    typeof value === 'number' ? value.toFixed(
      meta.step < 1 ? 2 : 0
    ) : value;

  return (
    <div className="param-slider">
      <div className="param-slider__header">
        <label
          className="param-slider__label"
          title={meta.description || name}
        >
          {name}
        </label>
        <span className="param-slider__value font-mono">
          {displayValue}
          {meta.unit ? ` ${meta.unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={value}
        onChange={(e) => onChange(name, parseFloat(e.target.value))}
        className="param-slider__range"
      />
    </div>
  );
}