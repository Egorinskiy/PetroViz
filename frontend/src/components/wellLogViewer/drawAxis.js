import * as d3 from 'd3';
import { formatLinearTick } from './utils';

/**
 * Рисует ось X (снизу трека) и вертикальную сетку.
 */
export function drawXAxis(g, x, xOffset, trackWidth, innerHeight, useLog, color) {
  const axis = useLog
    ? d3.axisBottom(x).ticks(3, '~g')
    : d3.axisBottom(x).ticks(5).tickFormat(formatLinearTick);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(axis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', color || '#333');

  // Вертикальная сетка
  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(
      d3
        .axisTop(x)
        .ticks(useLog ? 3 : 5)
        .tickSize(-innerHeight)
        .tickFormat('')
    )
    .selectAll('line')
    .style('stroke', '#e0e0e0');
}

/**
 * Подпись под треком: короткая мнемоника + единица + tooltip.
 */
export function drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units) {
  const rawUnit = units[curve] || '';
  const shortMnemonic = curve.length > 6 ? curve.slice(0, 6) : curve;
  const shortUnit = rawUnit.length > 6 ? rawUnit.slice(0, 6) : rawUnit;
  const label = shortUnit ? `${shortMnemonic} [${shortUnit}]` : shortMnemonic;
  const fullLabel = rawUnit ? `${curve} [${rawUnit}]` : curve;

  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', style.color)
    .style('cursor', 'help')
    .text(label)
    .append('title')
    .text(fullLabel);
}

/**
 * Заглушка "нет данных" в центре трека.
 */
export function drawNoData(g, xOffset, trackWidth, innerHeight, curve) {
  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight / 2)
    .attr('text-anchor', 'middle')
    .style('fill', '#999')
    .style('font-size', '12px')
    .text(`${curve.slice(0, 6)}: нет данных`)
    .append('title')
    .text(`${curve} — данных нет`);
}