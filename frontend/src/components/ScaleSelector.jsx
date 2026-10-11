import React from 'react';
import { DEPTH_SCALES } from '../constants/depthScales';

export function ScaleSelector({ value, onChange }) {
  return (
    <div className="scale-selector">
      <label>
        Масштаб:{' '}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {Object.keys(DEPTH_SCALES).map((key) => (
            <option key={key} value={key}>
              {key === 'full' ? 'Весь интервал' : key}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}