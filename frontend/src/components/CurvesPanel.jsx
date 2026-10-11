import React, { useMemo } from 'react';
import { isServiceCurve } from '../constants/curveFamilies';
import { CurveCheckbox } from './CurveCheckbox';

const MAX_CURVES = 8;

export function CurvesPanel({
  availableCurves,
  curveUnits,
  selectedCurves,
  onToggle,
}) {
  const { mainCurves, serviceCurves } = useMemo(() => {
    const main = [];
    const service = [];
    availableCurves.forEach((c) => {
      if (isServiceCurve(c)) service.push(c);
      else main.push(c);
    });
    return { mainCurves: main, serviceCurves: service };
  }, [availableCurves]);

  const renderCurve = (curve) => {
    const isSelected = selectedCurves.includes(curve);
    const disabled = !isSelected && selectedCurves.length >= MAX_CURVES;
    return (
      <CurveCheckbox
        key={curve}
        curve={curve}
        unit={curveUnits[curve]}
        isSelected={isSelected}
        disabled={disabled}
        onToggle={onToggle}
      />
    );
  };

  return (
    <div className="curves-panel">
      <div className="curves-columns">
        {mainCurves.length > 0 && (
          <div className="curves-column">
            <div className="group-header">
              Основные ({mainCurves.length})
            </div>
            <div className="checkbox-grid">
              {mainCurves.map(renderCurve)}
            </div>
          </div>
        )}
        {serviceCurves.length > 0 && (
          <div className="curves-column">
            <div className="group-header service">
              Служебные ({serviceCurves.length})
            </div>
            <div className="checkbox-grid">
              {serviceCurves.map(renderCurve)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}