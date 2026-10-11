// Семейства кривых: каноническое имя → список алиасов (мнемоник)
// Регистр не важен, все сравнения в UPPERCASE.
export const CURVE_FAMILIES = {
  GR: ['GR', 'GAM', 'GAPI', 'SGR', 'HSGR', 'GRD', 'CGR', 'GAMMA', 'GK', 'ГК'],
  RHOB: ['RHOB', 'RHOZ', 'ROBB', 'ROBB', 'DEN', 'ZDEN', 'GGK', 'GGKP', 'DENB', 'ПЛОТН'],
  NPHI: ['NPHI', 'CNL', 'TNPH', 'NEUT', 'NPOR', 'NNK', 'ННК', 'НГК'],
  DTC: ['DTC', 'DT', 'AC', 'SONIC', 'DTCO', 'DTP', 'AK', 'АК'],
  DTS: ['DTS', 'DTSM', 'DTSH'],
  SP: ['SP', 'SPR', 'PSP', 'SSP', 'PS', 'ПС'],
  CALI: ['CALI', 'CAL', 'CAV', 'CALIPER', 'DCAL', 'DS', 'DSFS'],
  BS: ['BS', 'BIT', 'BIT_SIZE', 'DIAM'],
  RDEP: ['RDEP', 'RT', 'ILD', 'LLD', 'RILD', 'RDEEP', 'RES', 'RLA5', 'AT90', 'AT60', 'AT90', 'AHT90', 'HDRS'],
  RMED: ['RMED', 'RME', 'RLA3', 'AT30', 'AHT30', 'HDRM'],
  RSHA: ['RSHA', 'RS', 'LLS', 'RLLS', 'RSS', 'RLA1', 'AT10', 'AT20', 'AHT10', 'AHT20', 'HDRL'],
  RXO: ['RXO', 'MLL', 'MSFL'],
  RMIC: ['RMIC', 'RMICRO', 'MICRO', 'RML', 'RMLL'],
  PEF: ['PEF', 'PE', 'PEFZ'],
  K: ['K', 'POTA', 'K40', 'HFK'],
  TH: ['TH', 'THOR', 'TH232'],
  U: ['U', 'URAN', 'U238'],
};

// Служебные мнемоники — не физические кривые
export const SERVICE_CURVES = [
  // Глубина и координаты
  'DEPT', 'DEPTH', 'INDEX', 'TIME', 'MD', 'TVD', 'TVDSS', 'TVD_SS',
  'DEPTH_MD', 'DEPTH_M', 'DEPT_M', 'MD_KB', 'MD_GL', 'DME',
  'X_LOC', 'Y_LOC', 'Z_LOC', 'X', 'Y', 'Z',
  // Литология / ML-выходы
  'LITHOLOGY', 'LITH', 'LITHOFACIES', 'FACIES', 'LITHOTYPE',
  'CONFIDENCE', 'PROB', 'PROBABILITY', 'CLASS', 'LABEL',
  // Разное
  'FORMATION', 'INTERVAL', 'FLAG', 'MARKER', 'ZONE', 'LAYER',
];

// Обратный индекс: ALIAS → FAMILY
const _ALIAS_TO_FAMILY = {};
for (const [family, aliases] of Object.entries(CURVE_FAMILIES)) {
  for (const alias of aliases) {
    _ALIAS_TO_FAMILY[alias.toUpperCase()] = family;
  }
}

export function getCurveFamily(mnemonic) {
  if (!mnemonic) return null;
  return _ALIAS_TO_FAMILY[mnemonic.toUpperCase()] || null;
}

export function isServiceCurve(mnemonic) {
  if (!mnemonic) return false;
  const upper = mnemonic.toUpperCase();
  if (SERVICE_CURVES.includes(upper)) return true;
  // FORCE_2020_LITHOFACIES_* и подобные — тоже служебные
  if (/LITHOFACIES|CONFIDENCE|PROBABILITY/i.test(mnemonic)) return true;
  return false;
}

// Кривые сопротивления — логарифмическая шкала
export const RESISTIVITY_FAMILIES = new Set([
  'RDEP', 'RMED', 'RSHA', 'RXO', 'RMIC',
]);