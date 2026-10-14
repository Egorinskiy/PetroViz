import React, { useMemo } from 'react';

const COLORS = {
  PHID: '#E65100',
  PHIN: '#0277BD',
  PHI_ND: '#00897B',
  PHIS: '#6A1B9A',
};

/** Валидные значения (не NaN, не null, finite). */
function valid(values) {
  return (values || []).filter((v) => v != null && isFinite(v));
}

function mean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function std(arr) {
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Корреляция Пирсона по парам (x,y), где обе валидны. */
function pearson(xs, ys) {
  const pairs = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x != null && isFinite(x) && y != null && isFinite(y)) {
      pairs.push([x, y]);
    }
  }
  if (pairs.length < 2) return null;
  const m = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / m;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / m;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : num / denom;
}

function fmt(v, decimals = 3) {
  if (v == null || !isFinite(v)) return '—';
  return v.toFixed(decimals);
}

export function PorosityStatistics({ curves }) {
  const stats = useMemo(() => {
    const rows = [];
    for (const [mnemonic, curve] of Object.entries(curves || {})) {
      const v = valid(curve.values);
      if (v.length === 0) {
        rows.push({ mnemonic, N: 0 });
        continue;
      }
      rows.push({
        mnemonic,
        N: v.length,
        mean: mean(v),
        median: median(v),
        std: std(v),
        min: Math.min(...v),
        max: Math.max(...v),
      });
    }
    return rows;
  }, [curves]);

  const corr = useMemo(() => {
    const names = Object.keys(curves || {});
    const result = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const x = (curves[names[i]].values) || [];
        const y = (curves[names[j]].values) || [];
        result.push({
          pair: `${names[i]} vs ${names[j]}`,
          r: pearson(x, y),
        });
      }
    }
    return result;
  }, [curves]);

  return (
    <div style={{ padding: '8px 0' }}>
      <div className="computations-panel__section-title">Статистика</div>

      <table
        className="table table--compact"
        style={{ fontSize: 11, width: '100%' }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Кривая</th>
            <th>N</th>
            <th>mean</th>
            <th>median</th>
            <th>std</th>
            <th>min</th>
            <th>max</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const color = COLORS[s.mnemonic] || '#333';
            return (
              <tr key={s.mnemonic}>
                <td style={{ color, fontWeight: 600 }}>{s.mnemonic}</td>
                <td style={{ textAlign: 'right' }}>{s.N}</td>
                <td style={{ textAlign: 'right' }}>{fmt(s.mean)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(s.median)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(s.std)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(s.min)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(s.max)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        className="computations-panel__section-title"
        style={{ marginTop: 16 }}
      >
        Корреляции (Пирсон)
      </div>

      <table
        className="table table--compact"
        style={{ fontSize: 11, width: '100%' }}
      >
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Пара</th>
            <th>r</th>
          </tr>
        </thead>
        <tbody>
          {corr.map((c) => (
            <tr key={c.pair}>
              <td>{c.pair}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                {fmt(c.r, 3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="text-xs text-muted"
        style={{ marginTop: 10, lineHeight: 1.4 }}
      >
        r близко к 1 — методы согласны. r {'<'} 0.7 — заметное расхождение
        (газовый эффект, литология, пропуски).
      </div>
    </div>
  );
}