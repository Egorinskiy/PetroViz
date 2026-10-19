// Масштаб глубины: px на метр
// 1:1000 = 1 px/m — стандарт веб-просмотра
export const DEPTH_SCALES = {
  '1:200': 5.0,
  '1:500': 2.0,
  '1:1000': 1.0,
  '1:2000': 0.5,
  '1:5000': 0.2,
  'full': null, // вся скважина в фиксированной высоте
};

export const DEFAULT_SCALE = 'full';
export const FULL_SCALE_HEIGHT = 720;
export const MIN_CANVAS_HEIGHT = 400;
export const MAX_CANVAS_HEIGHT = 40000;

export function computeCanvasHeight(scaleKey, depthRange) {
  const pxPerMeter = DEPTH_SCALES[scaleKey];
  if (pxPerMeter == null) return FULL_SCALE_HEIGHT;
  const height = Math.round(depthRange * pxPerMeter);
  return Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, height));
}

// ============================================================================
// B10: шаг сетки глубин по масштабу
// ============================================================================

export const GRID_STEP_BY_SCALE = {
  '1:200':  5,
  '1:500':  10,
  '1:1000': 25,
  '1:2000': 50,
  '1:5000': 100,
  'full':   null,  // авто
};

export const GRID_STEP_OPTIONS = [
  { value: 'auto', label: 'Авто' },
  { value: 2,      label: '2 м' },
  { value: 5,      label: '5 м' },
  { value: 10,     label: '10 м' },
  { value: 25,     label: '25 м' },
  { value: 50,     label: '50 м' },
  { value: 100,    label: '100 м' },
  { value: 200,    label: '200 м' },
];

const NICE_STEPS = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000];

/**
 * Возвращает шаг сетки (в метрах) для масштаба.
 * Для 'full' — auto по количеству тиков (~10).
 */
export function computeGridStep(scaleKey, depthRange) {
  const preset = GRID_STEP_BY_SCALE[scaleKey];
  if (preset != null) return preset;
  const target = depthRange / 10;
  for (const n of NICE_STEPS) {
    if (n >= target) return n;
  }
  return 2000;
}

/**
 * Генерирует массив глубин-тиков от minDepth до maxDepth с шагом step.
 * Кратно step, стабильно для одинаковых входов.
 */
export function generateDepthTicks(minDepth, maxDepth, step) {
  if (!step || step <= 0) return [];
  const start = Math.ceil(minDepth / step) * step;
  const ticks = [];
  const maxIter = 10000;
  let n = 0;
  for (let d = start; d <= maxDepth + 1e-9; d += step) {
    ticks.push(Math.round(d * 1000) / 1000);
    if (++n > maxIter) break;
  }
  return ticks;
}