import React, { useMemo, useState } from 'react';

const SIZE = 200;
const PADDING = 28;
const INNER = SIZE - PADDING * 2;
const PHI_MAX = 0.6;

// Встроенные цвета (расчётные кривые)
const BUILTIN_COLORS = {
  PHID: '#E65100',
  PHIN: '#0277BD',
  PHI_ND: '#00897B',
  PHIS: '#6A1B9A',
};

// Резерв для внешних кривых — совпадает с usePorosityExpress.EXTERNAL_COLORS
const EXTERNAL_COLORS = [
  '#212121', '#4E342E', '#880E4F', '#37474F', '#1B5E20', '#827717',
];

/**
 * Детерминированный цвет для любой кривой:
 * - встроенные (PHID/PHIN/PHI_ND/PHIS) — из BUILTIN_COLORS
 * - внешние — из EXTERNAL_COLORS по hash от имени (стабильно между рендерами)
 */
function pickColor(mnemonic) {
  if (BUILTIN_COLORS[mnemonic]) return BUILTIN_COLORS[mnemonic];
  let hash = 0;
  for (let i = 0; i < mnemonic.length; i++) {
    hash = (hash * 31 + mnemonic.charCodeAt(i)) >>> 0;
  }
  return EXTERNAL_COLORS[hash % EXTERNAL_COLORS.length];
}

function pairKey(x, y) {
  return `${x}__${y}`;
}

function extractPairs(curves, depth, xName, yName) {
  const xc = curves[xName];
  const yc = curves[yName];
  if (!xc || !yc) return [];
  const xs = xc.values || [];
  const ys = yc.values || [];
  const n = Math.min(xs.length, ys.length);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x != null && isFinite(x) && y != null && isFinite(y)) {
      pairs.push([x, y, depth[i]]);
    }
  }
  return pairs;
}

function Crossplot({ xName, yName, curves, depth, collapsed, onToggle }) {
  const pairs = useMemo(
    () => extractPairs(curves, depth, xName, yName),
    [curves, depth, xName, yName]
  );

  const step = pairs.length > 800 ? Math.ceil(pairs.length / 800) : 1;
  const visible = pairs.filter((_, i) => i % step === 0);

  const sx = (v) => PADDING + (v / PHI_MAX) * INNER;
  const sy = (v) => SIZE - PADDING - (v / PHI_MAX) * INNER;

  const xColor = pickColor(xName);
  const yColor = pickColor(yName);

  return (
    <div
      style={{
        marginBottom: 8,
        border: '1px solid #eee',
        borderRadius: 4,
        background: '#fff',
      }}
    >
      {/* Заголовок — кликабельный */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          cursor: 'pointer',
          userSelect: 'none',
          background: collapsed ? '#f8f8f8' : '#fff',
          borderRadius: collapsed ? 4 : '4px 4px 0 0',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600 }}>
          <span style={{ color: xColor }}>{xName}</span>
          {' vs '}
          <span style={{ color: yColor }}>{yName}</span>
          <span
            className="text-xs text-muted"
            style={{ marginLeft: 6, fontWeight: 400 }}
          >
            (N={pairs.length})
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            color: '#888',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.15s',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </div>

      {/* Тело — скрываем при collapsed */}
      {!collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 6 }}>
          <svg
            width={SIZE}
            height={SIZE}
            style={{
              background: '#fafafa',
              border: '1px solid #ddd',
              borderRadius: 4,
            }}
          >
            <line
              x1={PADDING} y1={SIZE - PADDING}
              x2={SIZE - PADDING} y2={SIZE - PADDING}
              stroke="#666"
            />
            <line
              x1={PADDING} y1={PADDING}
              x2={PADDING} y2={SIZE - PADDING}
              stroke="#666"
            />

            {[0.2, 0.4, 0.6].map((v) => (
              <g key={v}>
                <line
                  x1={sx(v)} y1={PADDING}
                  x2={sx(v)} y2={SIZE - PADDING}
                  stroke="#e0e0e0" strokeDasharray="2,2"
                />
                <line
                  x1={PADDING} y1={sy(v)}
                  x2={SIZE - PADDING} y2={sy(v)}
                  stroke="#e0e0e0" strokeDasharray="2,2"
                />
              </g>
            ))}

            <line
              x1={sx(0)} y1={sy(0)}
              x2={sx(PHI_MAX)} y2={sy(PHI_MAX)}
              stroke="#999"
              strokeDasharray="4,3"
            />

            {visible.map(([x, y], i) => (
              <circle
                key={i}
                cx={sx(x)}
                cy={sy(y)}
                r={1.2}
                fill="#444"
                opacity={0.35}
              />
            ))}

            <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" fontSize="9" fill="#666">
              {xName}
            </text>
            <text
              x={10} y={SIZE / 2}
              textAnchor="middle" fontSize="9" fill="#666"
              transform={`rotate(-90 10 ${SIZE / 2})`}
            >
              {yName}
            </text>
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * Возвращает все уникальные пары (i < j) из списка кривых,
 * отсортированные так, чтобы встроенные шли первыми (PHID, PHIN, PHI_ND, PHIS),
 * а внешние — в конце, в стабильном алфавитном порядке.
 */
function buildAllPairs(curves) {
  const names = Object.keys(curves || {});
  // Сначала встроенные (в фиксированном порядке), потом внешние (алфавит)
  const builtinOrder = ['PHID', 'PHIN', 'PHI_ND', 'PHIS'];
  const builtinPresent = builtinOrder.filter((n) => names.includes(n));
  const external = names
    .filter((n) => !builtinOrder.includes(n))
    .sort();
  const ordered = [...builtinPresent, ...external];

  const pairs = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      pairs.push([ordered[i], ordered[j]]);
    }
  }
  return pairs;
}

export function PorosityCrossplots({ curves, depth }) {
  // Динамические пары из всех кривых (встроенные + внешние)
  const available = useMemo(() => {
    const allPairs = buildAllPairs(curves);
    return allPairs.filter(([x, y]) => curves[x] && curves[y]);
  }, [curves]);

  // Все свёрнуты по умолчанию, кроме первого
  const [collapsed, setCollapsed] = useState(() => {
    const init = new Set();
    available.forEach(([x, y], i) => {
      if (i > 0) init.add(pairKey(x, y));
    });
    return init;
  });

  if (available.length === 0) {
    return (
      <div className="text-sm text-muted" style={{ padding: 12 }}>
        Недостаточно кривых для кросс-плотов.
      </div>
    );
  }

  const toggle = (x, y) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const k = pairKey(x, y);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const collapseAll = () => {
    const next = new Set();
    available.forEach(([x, y]) => next.add(pairKey(x, y)));
    setCollapsed(next);
  };

  const expandAll = () => {
    setCollapsed(new Set());
  };

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Кнопки управления */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 8,
          fontSize: 11,
        }}
      >
        <button
          className="btn btn--ghost btn--sm"
          onClick={expandAll}
          style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
        >
          ⬇ Развернуть все
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={collapseAll}
          style={{ flex: 1, padding: '4px 6px', fontSize: 11 }}
        >
          ⬆ Свернуть все
        </button>
      </div>

      {available.map(([x, y]) => (
        <Crossplot
          key={pairKey(x, y)}
          xName={x}
          yName={y}
          curves={curves}
          depth={depth}
          collapsed={collapsed.has(pairKey(x, y))}
          onToggle={() => toggle(x, y)}
        />
      ))}
    </div>
  );
}