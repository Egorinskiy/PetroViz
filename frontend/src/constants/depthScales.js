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