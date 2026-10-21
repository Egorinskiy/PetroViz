import React from 'react';
import { MAX_CURVES } from '../constants/limits';

export function CurvesBar({ selectedCurves }) {
  return (
    <div className="curves-bar">
      <span className="curves-bar-label">Кривые:</span>
      <span className="curves-bar-list font-mono" title={selectedCurves.join(', ')}>
        {selectedCurves.join(', ')}
      </span>
      <span className="curves-bar-count text-sm text-muted">
        {selectedCurves.length}/{MAX_CURVES}
      </span>
    </div>
  );
}