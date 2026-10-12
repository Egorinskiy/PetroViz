import React from 'react';

const MAX_CURVES = 8;

export function CurvesBar({ selectedCurves, isOpen, onToggle }) {
  return (
    <div className="curves-bar">
      <span className="curves-bar-label">Кривые:</span>
      <span className="curves-bar-list font-mono" title={selectedCurves.join(', ')}>
        {selectedCurves.join(', ')}
      </span>
      <span className="curves-bar-count text-sm text-muted">
        {selectedCurves.length}/{MAX_CURVES}
      </span>
      <button
        className="btn btn--ghost btn--sm curves-bar-toggle"
        onClick={onToggle}
      >
        {isOpen ? 'Свернуть ▲' : 'Изменить ▼'}
      </button>
    </div>
  );
}