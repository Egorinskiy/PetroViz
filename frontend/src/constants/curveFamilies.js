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
  RDEP: ['RDEP', 'RT', 'ILD', 'LLD', 'RILD', 'RDEEP', 'RES', 'RLA5', 'AT90'],
  RSHA: ['RSHA', 'RS', 'LLS', 'RLLS', 'RSS', 'RLA1', 'AT10'],
  RMED: ['RMED', 'RME', 'RLA3', 'AT30'],
  RXO: ['RXO', 'MLL', 'MSFL'],
  RMIC: ['RMIC', 'RMICRO', 'MICRO', 'RML', 'RMLL'],
  PEF: ['PEF', 'PE', 'PEFZ'],
  K: ['K', 'POTA', 'K40', 'HFK'],
  TH: ['TH', 'THOR', 'TH232'],
  U: ['U', 'URAN', 'U238'],
};

// Служебные мнемоники — не физические кривые
export const SERVICE_CURVES = [
  'DEPT', 'DEPTH', 'INDEX', 'TVD', 'TVDSS', 'TIME', 'MD', 'DEPTH_MD',
  'X_LOC', 'Y_LOC', 'Z_LOC',
  'LITHOLOGY', 'LITH', 'LITHOFACIES', 'FACIES', 'LITHOTYPE',
  'CONFIDENCE', 'PROB', 'PROBABILITY',
  'FORMATION', 'INTERVAL', 'FLAG', 'MARKER',
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