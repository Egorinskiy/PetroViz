import React from 'react';
import { GRID_STEP_OPTIONS } from '../constants/depthScales';

export function GridStepSelect({ value, onChange }) {
  const current = value === 'auto' || value == null ? 'auto' : String(value);
  return (
    <label className="view-control" title="Шаг горизонтальной сетки глубин">
      <span className="view-control__label">Сетка:</span>
      <select
        className="view-control__select"
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'auto' ? 'auto' : Number(v));
        }}
      >
        {GRID_STEP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}