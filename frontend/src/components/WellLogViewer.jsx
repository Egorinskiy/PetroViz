import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { buildTracks } from './wellLogViewer/buildTracks';
import { drawSingleTrack } from './wellLogViewer/drawSingleTrack';
import { drawCompositeDN } from './wellLogViewer/drawCompositeDN';
import { drawCompositeRes } from './wellLogViewer/drawCompositeRes';
import { DEFAULT_SCALE, computeCanvasHeight } from '../constants/depthScales';

const WellLogViewer = ({
  wellData,
  curvesToPlot,
  units = {},
  scale = DEFAULT_SCALE,
  previewData = null,
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!wellData || !curvesToPlot || curvesToPlot.length === 0) return;

    const tracks = buildTracks(curvesToPlot);
    const previewCurvesList = previewData?.curves
      ? Object.entries(previewData.curves)
      : [];

    // Геометрия
    const depthExtent = d3.extent(wellData.depth);
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

    const margin = { top: 25, right: 30, bottom: 130, left: 80 };
    const trackWidth = 150;
    const trackGap = 25;
    const totalTracks = tracks.length + previewCurvesList.length;
    const innerWidth = totalTracks * (trackWidth + trackGap);
    const totalWidth = innerWidth + margin.left + margin.right;
    const totalHeight = innerHeight + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // clipPath для каждого трека (включая preview)
    const defs = svg.append('defs');
    for (let idx = 0; idx < totalTracks; idx++) {
      const xOffset = idx * (trackWidth + trackGap);
      defs
        .append('clipPath')
        .attr('id', `clip-track-${idx}`)
        .append('rect')
        .attr('x', xOffset)
        .attr('y', 0)
        .attr('width', trackWidth)
        .attr('height', innerHeight);
    }

    // Шкала глубины
    const y = d3.scaleLinear().domain(depthExtent).range([0, innerHeight]);

    // Горизонтальная сетка
    g.append('g')
      .call(d3.axisLeft(y).ticks(12).tickSize(-innerWidth).tickFormat(''))
      .selectAll('line')
      .style('stroke', '#d0d0d0')
      .style('stroke-dasharray', '3,2');

    // Ось глубины
    g.append('g')
      .call(d3.axisLeft(y).ticks(12).tickFormat(d3.format('.0f')))
      .selectAll('text')
      .style('font-size', '11px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .text('Глубина (м)');

    // ========================================================================
    // Основные треки (каротаж)
    // ========================================================================
    tracks.forEach((track, trackIdx) => {
      const xOffset = trackIdx * (trackWidth + trackGap);
      const clipId = `url(#clip-track-${trackIdx})`;

      g.append('rect')
        .attr('x', xOffset)
        .attr('y', 0)
        .attr('width', trackWidth)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('stroke', '#aaa');

      if (track.type === 'composite_dn') {
        drawCompositeDN(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId);
      } else if (track.type === 'composite_res') {
        drawCompositeRes(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId, units);
      } else {
        drawSingleTrack(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId, units);
      }
    });

    // ========================================================================
    // Preview-треки (петрофизический расчёт)
    // ========================================================================
    const previewDepths = previewData?.depth || [];

    previewCurvesList.forEach(([mnemonic, curve], previewIdx) => {
      const trackIdx = tracks.length + previewIdx;
      const xOffset = trackIdx * (trackWidth + trackGap);
      const clipId = `url(#clip-track-${trackIdx})`;

      // Рамка
      g.append('rect')
        .attr('x', xOffset)
        .attr('y', 0)
        .attr('width', trackWidth)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('stroke', '#aaa');

      const rawValues = curve.values || [];
      const validValues = rawValues.filter((v) => v != null && isFinite(v));

      if (validValues.length === 0) {
        g.append('text')
          .attr('x', xOffset + trackWidth / 2)
          .attr('y', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .style('fill', '#999')
          .style('font-size', '12px')
          .text(`${mnemonic}: нет данных`);
        return;
      }

      const upper = mnemonic.toUpperCase();
      const isNormalized =
        upper.startsWith('VSH') ||
        upper.startsWith('SW') ||
        upper.startsWith('PHI');

      // Цвет: VSH — зелёный (как GR), остальные — красный
      const color = upper.startsWith('VSH') ? '#388e3c' : '#C62828';

      // Ось X: [0, 1] для нормированных, иначе по диапазону
      let x;
      if (isNormalized) {
        x = d3.scaleLinear()
          .domain([0, 1])
          .range([xOffset, xOffset + trackWidth]);
      } else {
        const extent = d3.extent(validValues);
        x = d3.scaleLinear().domain(extent).range([xOffset, xOffset + trackWidth]).nice();
      }

      // Ось X снизу
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.1f')))
        .selectAll('text')
        .style('font-size', '9px');

      // Вертикальная сетка
      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(d3.axisTop(x).ticks(5).tickSize(-innerHeight).tickFormat(''))
        .selectAll('line')
        .style('stroke', '#e0e0e0');

      // ⚠️ ВАЖНО: previewDepths[i] вместо wellData.depth[i]
      const line = d3.line()
        .defined((d, i) => d != null && isFinite(d) && previewDepths[i] != null)
        .x((d) => x(d))
        .y((_, i) => y(previewDepths[i]));

      g.append('path')
        .datum(rawValues)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('d', line)
        .attr('clip-path', clipId);

      // Подпись
      g.append('text')
        .attr('x', xOffset + trackWidth / 2)
        .attr('y', innerHeight + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', color)
        .text(mnemonic)
        .append('title')
        .text(`Расчёт: ${mnemonic} (${validValues.length} из ${rawValues.length} точек)`);
    });
  }, [wellData, curvesToPlot, units, scale, previewData]);

  return (
    <div style={{ marginTop: '5px' }}>
      <div
        style={{
          overflow: 'auto',
          maxHeight: 'calc(100vh - 140px)',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
          background: '#fafafa',
        }}
      >
        <svg ref={svgRef} />
      </div>
    </div>
  );
};

export default WellLogViewer;