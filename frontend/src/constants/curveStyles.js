// Стили кривых: цвет, толщина, инверсия оси, границы domain
export const CURVE_STYLES = {
  GR:   { color: '#2e7d32', width: 1.3 },
  RHOB: { color: '#c62828', width: 1.3, domain: [1.84, 2.68] },
  NPHI: { color: '#1565c0', width: 1.3, reversed: true, domain: [0.5, 0] },

  DTC:  { color: '#6a1b9a', width: 1.3 },
  DTS:  { color: '#8e24aa', width: 1.3 },

  SP:   { color: '#6d4c41', width: 1.3 },

  CALI: { color: '#37474f', width: 1.3 },
  BS:   { color: '#78909c', width: 1.0 },

  // Сопротивления: градация от чёрного (глубокий) к светлому (мелкий)
  RDEP: { color: '#000000', width: 2.0 },
  RMED: { color: '#444444', width: 1.6 },
  RSHA: { color: '#888888', width: 1.3 },
  RXO:  { color: '#1b5e20', width: 1.0 },
  RMIC: { color: '#0d47a1', width: 1.0 },

  // Гамма-спектрометрия
  K:    { color: '#ec407a', width: 1.3 },
  TH:   { color: '#9e9e9e', width: 1.3 },
  U:    { color: '#00e676', width: 1.3 },

  PEF:  { color: '#5d4037', width: 1.3 },
};

export const SERVICE_STYLE = { color: '#9e9e9e', width: 1.0 };

export const DEFAULT_PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

export function getCurveStyle(family, index) {
  if (family && CURVE_STYLES[family]) return CURVE_STYLES[family];
  return {
    color: DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
    width: 1.3,
  };
}