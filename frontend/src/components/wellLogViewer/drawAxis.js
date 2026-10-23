import * as d3 from 'd3';
import { formatLinearTick } from './utils';

/**
 * Рисует ось X сверху и снизу трека + вертикальную сетку.
 */
export function drawXAxis(g, x, xOffset, trackWidth, innerHeight, useLog, color) {
  // --- Ось снизу ---
  const bottomAxis = useLog
    ? d3.axisBottom(x).ticks(3, '~g')
    : d3.axisBottom(x).ticks(5).tickFormat(formatLinearTick);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(bottomAxis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', color || '#333');

  // --- Ось сверху (подписи + сетка) ---
  const topAxis = useLog
    ? d3.axisTop(x).ticks(3, '~g').tickSize(-innerHeight)
    : d3.axisTop(x).ticks(5).tickFormat(formatLinearTick).tickSize(-innerHeight);

  const topG = g.append('g')
    .attr('transform', 'translate(0,0)')
    .call(topAxis);

  topG.selectAll('text')
    .style('font-size', '9px')
    .style('fill', color || '#333');

  topG.selectAll('.tick line')
    .style('stroke', '#e0e0e0');

  topG.selectAll('.domain').remove();
}

/**
 * B41: заголовок трека сверху (над осью X).
 * Используется для дублирования названия метода/кривой — при длинных
 * треках нижняя подпись уходит за экран, а верхняя видна.
 */
export function drawTrackTitle(g, xOffset, trackWidth, title, color = '#1A3D5C') {
  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', -22)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', color)
    .style('letter-spacing', '0.3px')
    .text(title)
    .append('title')
    .text(title);
}

/**
 * Подпись под треком: короткая мнемоника + единица + tooltip.
 * B41: также дублирует заголовок сверху через drawTrackTitle.
 */
export function drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units) {
  const rawUnit = units[curve] || '';
  const shortMnemonic = curve.length > 6 ? curve.slice(0, 6) : curve;
  const shortUnit = rawUnit.length > 6 ? rawUnit.slice(0, 6) : rawUnit;
  const label = shortUnit ? `${shortMnemonic} [${shortUnit}]` : shortMnemonic;
  const fullLabel = rawUnit ? `${curve} [${rawUnit}]` : curve;

  // Подпись снизу
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

  // Заголовок сверху (дубль)
  drawTrackTitle(g, xOffset, trackWidth, label, style.color);
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