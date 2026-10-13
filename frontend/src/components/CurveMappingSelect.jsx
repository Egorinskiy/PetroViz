import React from 'react';

const ROLE_LABELS = {
  gr: 'GR (гамма-каротаж)',
  rhob: 'RHOB (плотность)',
  nphi: 'NPHI (нейтрон)',
  dtc: 'DTC (акустика)',
  rt: 'Rt (сопротивление)',
  pef: 'PEF',
};

export function CurveMappingSelect({
  role,
  availableCurves,
  value,
  onChange,
}) {
  return (
    <div className="curve-mapping-row">
      <label
        className="curve-mapping-row__label"
        title={ROLE_LABELS[role] || role}
      >
        {role.toUpperCase()}
      </label>
      <select
        className="select curve-mapping-row__select"
        value={value || ''}
        onChange={(e) => onChange(role, e.target.value)}
      >
        <option value="">(авто-определение)</option>
        {availableCurves.map((c) => (
          <option key={c.mnemonic} value={c.mnemonic}>
            {c.mnemonic}
            {c.unit ? ` [${c.unit}]` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}