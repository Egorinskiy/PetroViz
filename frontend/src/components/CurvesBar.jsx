import React from 'react';

const MAX_CURVES = 8;

export function CurvesBar({ selectedCurves, isOpen, onToggle }) {
  return (
    <div className="curves-bar">
      <span className="curves-bar-label">Кривые:</span>
      <span className="curves-bar-list" title={selectedCurves.join(', ')}>
        {selectedCurves.join(', ')}
      </span>
      <span className="curves-bar-count">
        {selectedCurves.length}/{MAX_CURVES}
      </span>
      <button className="curves-bar-toggle" onClick={onToggle}>
        {isOpen ? 'Свернуть ▲' : 'Изменить ▼'}
      </button>
    </div>
  );
}