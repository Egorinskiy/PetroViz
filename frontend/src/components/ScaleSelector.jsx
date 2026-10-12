import React from 'react';
import { DEPTH_SCALES } from '../constants/depthScales';

export function ScaleSelector({ value, onChange }) {
  return (
    <div className="scale-selector">
      <label className="text-sm text-muted">Масштаб:</label>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Object.keys(DEPTH_SCALES).map((key) => (
          <option key={key} value={key}>
            {key === 'full' ? 'Весь интервал' : key}
          </option>
        ))}
      </select>
    </div>
  );
}