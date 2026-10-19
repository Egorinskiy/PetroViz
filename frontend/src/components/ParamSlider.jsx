import React, { useState, useRef, useEffect } from 'react';

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
  const realValue = value ?? meta.default;

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
        <EditableNumber
          value={realValue}
          decimals={decimals}
          unit={unit}
          min={min}
          max={max}
          onCommit={(v) => onChange(name, v)}
        />
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

function EditableNumber({ value, decimals, unit, min, max, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const display = (isFinite(value) ? Number(value) : 0).toFixed(decimals);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(display);
    setEditing(true);
  };

  const commit = () => {
    const num = Number(draft);
    if (Number.isFinite(num)) {
      const clamped = Math.min(Math.max(num, min), max);
      onCommit(clamped);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          step={Math.pow(10, -decimals)}
          style={{
            width: 60,
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
            padding: '1px 4px',
            border: '1px solid #1565c0',
            borderRadius: 3,
            textAlign: 'right',
          }}
        />
        {unit && <span style={{ marginLeft: 2 }}>{unit}</span>}
      </span>
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Двойной клик — редактировать"
      style={{
        fontFamily: 'monospace',
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        borderBottom: '1px dashed #ccc',
      }}
    >
      {display} {unit}
    </span>
  );
}