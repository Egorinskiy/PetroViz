import * as d3 from 'd3';
import { CURVE_STYLES } from '../../constants/curveStyles';

export function drawCompositeDN(
  g,
  track,
  xOffset,
  trackWidth,
  innerHeight,
  y,
  wellData,
  clipId
) {
  const [densityCurve, neutronCurve] = track.curves;
  const dStyle = CURVE_STYLES.RHOB;
  const nStyle = CURVE_STYLES.NPHI;

  const xDensity = d3
    .scaleLinear()
    .domain(dStyle.domain)
    .range([xOffset, xOffset + trackWidth]);

  const xNeutron = d3
    .scaleLinear()
    .domain(nStyle.domain)
    .range([xOffset, xOffset + trackWidth]);

  // Обе линейки снизу
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xDensity).ticks(4).tickFormat(d3.format('.2f')))
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', dStyle.color);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight + 28})`)
    .call(d3.axisBottom(xNeutron).ticks(4).tickFormat(d3.format('.2f')))
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', nStyle.color);

  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 58)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', dStyle.color)
    .text('RHOB (g/cm³)')
    .append('title').text(densityCurve);

  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 74)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', nStyle.color)
    .text('NPHI (v/v)')
    .append('title').text(neutronCurve);

  // Сетка по NPHI
  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(
      d3.axisTop(xNeutron).ticks(4).tickSize(-innerHeight).tickFormat('')
    )
    .selectAll('line')
    .style('stroke', '#e0e0e0');

  // Данные
  const depValues = wellData[densityCurve] || [];
  const neuValues = wellData[neutronCurve] || [];
  const depth = wellData.depth;

  // Сегменты заливки (плотность левее нейтрона)
  const segments = [];
  let current = null;

  for (let i = 0; i < depth.length; i++) {
    const d = depValues[i];
    const n = neuValues[i];
    const valid = d != null && n != null && isFinite(d) && isFinite(n);
    const isCrossover = valid && xDensity(d) < xNeutron(n);

    if (isCrossover) {
      if (!current) current = [];
      current.push({ depth: depth[i], xD: xDensity(d), xN: xNeutron(n) });
    } else if (current) {
      current.push({ depth: depth[i], xD: xDensity(d), xN: xNeutron(n) });
      segments.push(current);
      current = null;
    }
  }
  if (current) segments.push(current);

  segments.forEach((seg) => {
    if (seg.length < 2) return;
    const area = d3
      .area()
      .x0((pt) => pt.xD)
      .x1((pt) => pt.xN)
      .y((pt) => y(pt.depth));

    g.append('path')
      .datum(seg)
      .attr('fill', '#ffe082')
      .attr('fill-opacity', 0.65)
      .attr('stroke', 'none')
      .attr('d', area)
      .attr('clip-path', clipId);
  });

  const lineD = d3
    .line()
    .defined((d) => d != null && isFinite(d))
    .x((d) => xDensity(d))
    .y((_, idx) => y(depth[idx]));

  const lineN = d3
    .line()
    .defined((d) => d != null && isFinite(d))
    .x((d) => xNeutron(d))
    .y((_, idx) => y(depth[idx]));

  g.append('path')
    .datum(depValues)
    .attr('fill', 'none')
    .attr('stroke', dStyle.color)
    .attr('stroke-width', dStyle.width)
    .attr('d', lineD)
    .attr('clip-path', clipId);

  g.append('path')
    .datum(neuValues)
    .attr('fill', 'none')
    .attr('stroke', nStyle.color)
    .attr('stroke-width', nStyle.width)
    .attr('d', lineN)
    .attr('clip-path', clipId);
}