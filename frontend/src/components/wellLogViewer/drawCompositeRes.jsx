import * as d3 from 'd3';
import { getCurveFamily } from '../../constants/curveFamilies';
import { getCurveStyle } from '../../constants/curveStyles';
import { drawXAxis, drawTrackLabel, drawNoData } from './drawAxis';

/**
 * Composite-трек УЭС + опциональный overlay R0 (кривая сопротивления
 * водонасыщенной породы — используется для валидации модели Archie).
 *
 * R0 рисуется на той же логарифмической шкале, что и RT — чтобы в
 * водонасыщенных интервалах линии сходились (R0 ≈ Rt), а в нефтегазовых
 * R0 уходил влево от Rt.
 */
export function drawCompositeRes(
  g,
  track,
  xOffset,
  trackWidth,
  innerHeight,
  y,
  wellData,
  clipId,
  units,
  r0Data = null,       // { values: number[], depth: number[] }
) {
  const allPositive = [];
  track.curves.forEach((curve) => {
    const values = wellData[curve] || [];
    values.forEach((v) => {
      if (v != null && isFinite(v) && v > 0) allPositive.push(v);
    });
  });

  // Включаем R0 в общий extent (только положительные)
  const r0Positive = [];
  if (r0Data?.values) {
    for (const v of r0Data.values) {
      if (v != null && isFinite(v) && v > 0) r0Positive.push(v);
    }
  }
  const extentValues = [...allPositive, ...r0Positive];

  if (extentValues.length === 0) {
    track.curves.forEach((curve, i) => {
      const style = getCurveStyle(getCurveFamily(curve), i);
      drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units);
    });
    drawNoData(g, xOffset, trackWidth, innerHeight, track.curves[0]);
    return;
  }

  // Фиксированная логарифмическая шкала 1–500 Ом·м
  // (жёсткая граница — для стабильной настройки модели Archie/R0)
  const x = d3
    .scaleLog()
    .domain([1, 500])
    .range([xOffset, xOffset + trackWidth]);

  // B41: заголовок трека сверху
  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', -22)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .style('letter-spacing', '0.3px')
    .text(r0Data ? 'RES + R0' : 'RES');

  // Ось снизу
  const logAxis = d3.axisBottom(x).ticks(3, '~g');
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(logAxis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', '#333');

  // Ось X сверху (log labels + grid)
  const topG = g.append('g')
    .attr('transform', 'translate(0,0)')
    .call(
      d3.axisTop(x).ticks(3, '~g').tickSize(-innerHeight)
    );

  topG.selectAll('text')
    .style('font-size', '9px')
    .style('fill', '#333');

  topG.selectAll('.tick line')
    .style('stroke', '#e0e0e0');

  topG.selectAll('.domain').remove();

  // Кривые УЭС
  track.curves.forEach((curve, i) => {
    const family = getCurveFamily(curve);
    const style = getCurveStyle(family, i);
    const values = wellData[curve] || [];

    const line = d3
      .line()
      .defined((d) => d != null && isFinite(d) && d > 0)
      .x((d) => x(d))
      .y((_, idx) => y(wellData.depth[idx]));

    g.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', style.color)
      .attr('stroke-width', style.width)
      .attr('d', line)
      .attr('clip-path', clipId);
  });

  // R0 overlay — чёрная толстая пунктирная
  if (r0Data?.values && r0Positive.length > 0) {
    const r0Line = d3
      .line()
      .defined(
        (d, i) =>
          d != null &&
          isFinite(d) &&
          d > 0 &&
          r0Data.depth[i] != null
      )
      .x((d) => x(d))
      .y((_, i) => y(r0Data.depth[i]));

    g.append('path')
      .datum(r0Data.values)
      .attr('fill', 'none')
      .attr('stroke', '#D81B60')  // малиново-розовый, контрастный к серо-чёрному
      .attr('stroke-width', 1.5)
      .attr('d', r0Line)
      .attr('clip-path', clipId);

    // Легенда R0 под осью
    g.append('text')
      .attr('x', xOffset + trackWidth / 2)
      .attr('y', innerHeight + 62)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#D81B60')
      .text('━ ━ R0')
      .append('title')
      .text('Сопротивление водонасыщенной породы (для валидации Archie)');
  }

  // Подписи кривых УЭС под треком
  const total = track.curves.length;
  track.curves.forEach((curve, i) => {
    const family = getCurveFamily(curve);
    const style = getCurveStyle(family, i);
    const xPos = xOffset + ((i + 0.5) * trackWidth) / total;
    const short = curve.length > 6 ? curve.slice(0, 6) : curve;

    g.append('text')
      .attr('x', xPos)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', style.color)
      .style('cursor', 'help')
      .text(short)
      .append('title').text(curve);
  });
}