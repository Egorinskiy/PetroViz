import React, { useMemo } from 'react';

const CATEGORY_LABELS = {
  vshale: 'Глинистость (Vshale)',
  porosity: 'Пористость',
  swi: 'Связанная вода (Swi)',
  sw: 'Водонасыщенность (Sw)',
  perm: 'Проницаемость',
};

export function MethodSelector({ methods, value, onChange }) {
  const grouped = useMemo(() => {
    const g = {};
    methods.forEach((m) => {
      if (!g[m.category]) g[m.category] = [];
      g[m.category].push(m);
    });
    return g;
  }, [methods]);

  return (
    <div className="method-selector">
      <label className="label" htmlFor="method-select">
        Метод
      </label>
      <select
        id="method-select"
        className="select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— выберите метод —</option>
        {Object.entries(grouped).map(([cat, list]) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat] || cat}>
            {list.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}