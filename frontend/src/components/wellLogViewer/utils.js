import * as d3 from 'd3';

// Перцентиль для обрезки выбросов
export function percentile(arr, p) {
  const sorted = arr.slice().sort(d3.ascending);
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  );
  return sorted[idx];
}

// Domain с обрезкой выбросов по 1% / 99%
export function robustDomain(values, hardDomain) {
  if (hardDomain) return hardDomain;
  const valid = values.filter((v) => v != null && isFinite(v));
  if (valid.length === 0) return [0, 1];
  const p1 = percentile(valid, 0.01);
  const p99 = percentile(valid, 0.99);
  if (p1 === p99) return [p1 - 1, p99 + 1];
  return [p1, p99];
}

// Формат тиков оси X: без экспоненты до 5 знаков
export function formatLinearTick(v) {
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1000) return d3.format(',.0f')(v);
  if (abs >= 10) return d3.format('.0f')(v);
  if (abs >= 1) return d3.format('.2f')(v);
  return d3.format('.3g')(v);
}