import {
  getCurveFamily,
  RESISTIVITY_FAMILIES,
} from '../../constants/curveFamilies';

/**
 * Группирует кривые в треки:
 *  - RHOB + NPHI  → composite_dn
 *  - все УЭС      → composite_res
 *  - остальные    → single (по одной на трек)
 */
export function buildTracks(curvesToPlot) {
  const tracks = [];
  let densityCurve = null;
  let neutronCurve = null;
  const resistivityCurves = [];

  for (const curve of curvesToPlot) {
    const family = getCurveFamily(curve);
    if (family === 'RHOB' && !densityCurve) densityCurve = curve;
    else if (family === 'NPHI' && !neutronCurve) neutronCurve = curve;
    else if (family && RESISTIVITY_FAMILIES.has(family))
      resistivityCurves.push(curve);
    else tracks.push({ type: 'single', curves: [curve], family });
  }

  if (densityCurve && neutronCurve) {
    tracks.push({
      type: 'composite_dn',
      curves: [densityCurve, neutronCurve],
    });
  } else {
    if (densityCurve)
      tracks.push({ type: 'single', curves: [densityCurve], family: 'RHOB' });
    if (neutronCurve)
      tracks.push({ type: 'single', curves: [neutronCurve], family: 'NPHI' });
  }

  if (resistivityCurves.length > 0) {
    tracks.push({ type: 'composite_res', curves: resistivityCurves });
  }

  return tracks;
}