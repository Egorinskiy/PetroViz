import React from 'react';

export function CurveCheckbox({
  curve,
  unit,
  isSelected,
  disabled,
  onToggle,
}) {
  const shortMnemonic = curve.length > 6 ? curve.slice(0, 6) : curve;
  const shortUnit = unit && unit.length > 6 ? unit.slice(0, 6) : unit;
  const shortLabel = shortUnit
    ? `${shortMnemonic} [${shortUnit}]`
    : shortMnemonic;
  const fullLabel = unit ? `${curve} [${unit}]` : curve;

  return (
    <label
      title={fullLabel}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        disabled={disabled}
        onChange={() => onToggle(curve)}
      />{' '}
      {shortLabel}
    </label>
  );
}