import React, { useState, useEffect, useRef } from 'react';

/**
 * Компактный выбор кровли-подошвы отображения.
 * value = { top, bottom } | null (null = весь интервал).
 */
export function DepthRangePicker({ minDepth, maxDepth, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState('');
  const [bottom, setBottom] = useState('');
  const [error, setError] = useState(null);
  const ref = useRef(null);

  // При открытии — подставить текущие значения или полный диапазон
  useEffect(() => {
    if (!open) return;
    setTop(String(Math.round(value?.top ?? minDepth ?? 0)));
    setBottom(String(Math.round(value?.bottom ?? maxDepth ?? 0)));
    setError(null);
  }, [open, value, minDepth, maxDepth]);

  // Закрытие по клику вне
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const display = value
    ? `${Math.round(value.top)}–${Math.round(value.bottom)} м`
    : 'Весь интервал';

  const apply = () => {
    setError(null);
    const t = Number(top);
    const b = Number(bottom);
    if (!isFinite(t) || !isFinite(b)) {
      setError('Введите числа');
      return;
    }
    const lo = minDepth ?? Math.min(t, b);
    const hi = maxDepth ?? Math.max(t, b);
    const clampedTop = Math.max(lo, Math.min(t, hi));
    const clampedBottom = Math.max(lo, Math.min(b, hi));
    if (clampedBottom <= clampedTop) {
      setError('Подошва должна быть ниже кровли');
      return;
    }
    onChange({ top: clampedTop, bottom: clampedBottom });
    setOpen(false);
  };

  const reset = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <div className="depth-range-picker" ref={ref}>
      <button
        type="button"
        className={`view-control view-control--button ${value ? 'view-control--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Диапазон отображения глубин"
      >
        <span className="view-control__label">Глубины:</span>
        <span className="view-control__value">{display}</span>
      </button>

      {open && (
        <div className="depth-range-popover">
          <div className="depth-range-popover__row">
            <label>Кровля, м:</label>
            <input
              type="number"
              value={top}
              onChange={(e) => setTop(e.target.value)}
              step="1"
              onKeyDown={(e) => e.key === 'Enter' && apply()}
            />
          </div>
          <div className="depth-range-popover__row">
            <label>Подошва, м:</label>
            <input
              type="number"
              value={bottom}
              onChange={(e) => setBottom(e.target.value)}
              step="1"
              onKeyDown={(e) => e.key === 'Enter' && apply()}
            />
          </div>
          {error && (
            <div className="text-xs" style={{ color: 'var(--color-danger)', marginTop: 4 }}>
              {error}
            </div>
          )}
          <div className="depth-range-popover__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Весь интервал
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={apply}>
              Применить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}