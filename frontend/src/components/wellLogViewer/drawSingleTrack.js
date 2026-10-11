import * as d3 from 'd3';
import {
  isServiceCurve,
  RESISTIVITY_FAMILIES,
} from '../../constants/curveFamilies';
import { getCurveStyle, SERVICE_STYLE } from '../../constants/curveStyles';
import { robustDomain } from './utils';
import { drawXAxis, drawTrackLabel, drawNoData } from './drawAxis';

export function drawSingleTrack(
  g,
  track,
  xOffset,
  trackWidth,
  innerHeight,
  y,
  wellData,
  clipId,
  units
) {
  const curve = track.curves[0];
  const family = track.family;
  const style = isServiceCurve(curve)
    ? SERVICE_STYLE
    : getCurveStyle(family, 0);

  const rawValues = wellData[curve] || [];
  const validValues = rawValues.filter((v) => v != null && isFinite(v));

  if (validValues.length === 0) {
    drawNoData(g, xOffset, trackWidth, innerHeight, curve);
    drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units);
    return;
  }

  const useLog = family && RESISTIVITY_FAMILIES.has(family);
  let x;

  if (useLog) {
    const positive = validValues.filter((v) => v > 0);
    if (positive.length > 0) {
      const [dMin, dMax] = d3.extent(positive);
      x = d3
        .scaleLog()
        .domain([Math.max(dMin * 0.8, 0.001), dMax * 1.2])
        .range([xOffset, xOffset + trackWidth]);
    } else {
      x = d3.scaleLinear().domain([0, 1]).range([xOffset, xOffset + trackWidth]);
    }
  } else {
    const domain = robustDomain(validValues, style.domain);
    x = d3.scaleLinear().domain(domain).range([xOffset, xOffset + trackWidth]).nice();
  }

  if (style.reversed) x.range([xOffset + trackWidth, xOffset]);

  drawXAxis(g, x, xOffset, trackWidth, innerHeight, useLog, style.color);

  const line = d3
    .line()
    .defined((d) => d != null && isFinite(d))
    .x((d) => x(d))
    .y((_, idx) => y(wellData.depth[idx]));

  g.append('path')
    .datum(rawValues)
    .attr('fill', 'none')
    .attr('stroke', style.color)
    .attr('stroke-width', style.width)
    .attr('d', line)
    .attr('clip-path', clipId);

  drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units);
}