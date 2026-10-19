import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { buildTracks } from './wellLogViewer/buildTracks';
import { drawSingleTrack } from './wellLogViewer/drawSingleTrack';
import { drawCompositeDN } from './wellLogViewer/drawCompositeDN';
import { drawCompositeRes } from './wellLogViewer/drawCompositeRes';
import { DEFAULT_SCALE, computeCanvasHeight } from '../constants/depthScales';

// Палитра для express-трека пористости
const POROSITY_COLORS = {
  PHID: '#E65100',
  PHIN: '#0277BD',
  PHI_ND: '#00897B',
  PHIS: '#6A1B9A',
};
// Цвета и подписи для fluid zones
const FLUID_COLORS = {
  water: '#0277BD',
  oil: '#2E7D32',
  gas: '#C62828',
  custom: '#666666',
};
const FLUID_LABELS = {
  water: 'Вода',
  oil: 'Нефть',
  gas: 'Газ',
  custom: 'Custom',
};

const WellLogViewer = ({
  wellData,
  curvesToPlot,
  units = {},
  scale = DEFAULT_SCALE,
  previewData = null,
  porosityExpress = null,
  fluidZones = [],
  savedTracks = [],
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!wellData || !curvesToPlot || curvesToPlot.length === 0) return;

    const tracks = buildTracks(curvesToPlot);

    // --- Собираем список preview-треков (live + saved) ---
    const previewCurvesList = [];
    if (previewData?.curves) {
      for (const [mnemonic, curve] of Object.entries(previewData.curves)) {
        previewCurvesList.push({
          mnemonic,
          values: curve.values,
          depth: previewData.depth,
          isSaved: false,
          key: `live-${mnemonic}`,
        });
      }
    }
    for (const t of (savedTracks || [])) {
      previewCurvesList.push({
        mnemonic: t.label || t.mnemonic,
        values: t.values,
        depth: t.depth,
        isSaved: true,
        key: `saved-${t.id}`,
      });
    }

    // --- Express-трек (4 кривые на одном) ---
    const expressCurves = porosityExpress?.curves
      ? Object.entries(porosityExpress.curves)
      : [];
    const hasExpress = expressCurves.length > 0 && porosityExpress?.depth;

    // Геометрия
    const depthExtent = d3.extent(wellData.depth);
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

    const margin = { top: 25, right: 30, bottom: 130, left: 80 };
    const trackWidth = 150;
    const trackGap = 25;
    const totalTracks =
      tracks.length + previewCurvesList.length + (hasExpress ? 1 : 0);
    const innerWidth = totalTracks * (trackWidth + trackGap);
    const totalWidth = innerWidth + margin.left + margin.right;
    const totalHeight = innerHeight + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // clipPath для каждого трека
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
    // Основные треки каротажа
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
    // Preview-треки (одиночные расчёты + сохранённые)
    // ========================================================================
    previewCurvesList.forEach((item, previewIdx) => {
      const { mnemonic, values, depth: trackDepth, isSaved } = item;
      const trackIdx = tracks.length + previewIdx;
      const xOffset = trackIdx * (trackWidth + trackGap);
      const clipId = `url(#clip-track-${trackIdx})`;

      g.append('rect')
        .attr('x', xOffset).attr('y', 0)
        .attr('width', trackWidth).attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('stroke', isSaved ? '#1565c0' : '#aaa');

      const validValues = (values || []).filter((v) => v != null && isFinite(v));
      if (validValues.length === 0) {
        g.append('text')
          .attr('x', xOffset + trackWidth / 2)
          .attr('y', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .style('fill', '#999').style('font-size', '12px')
          .text(`${mnemonic}: нет данных`);
        return;
      }

      const upper = mnemonic.toUpperCase();
      const isVshale = upper.startsWith('VSH');
      const isSaturation = upper.startsWith('SW');
      const isPorosity = upper.startsWith('PHI');

      let color;
      if (isSaved) {
        color = '#1565c0';
      } else if (isVshale) {
        color = '#388e3c';
      } else if (upper === 'PHI_ND') {
        color = '#00897B';
      } else if (upper.startsWith('PHID')) {
        color = '#E65100';
      } else if (upper.startsWith('PHIN')) {
        color = '#0277BD';
      } else if (upper.startsWith('PHIS')) {
        color = '#6A1B9A';
      } else if (isPorosity) {
        color = '#E65100';
      } else if (isSaturation) {
        color = '#1565c0';
      } else {
        color = '#C62828';
      }

      let x;
      if (isVshale || isSaturation) {
        x = d3.scaleLinear().domain([0, 1]).range([xOffset, xOffset + trackWidth]);
      } else if (isPorosity) {
        x = d3.scaleLinear().domain([0, 0.6]).range([xOffset, xOffset + trackWidth]);
      } else {
        const extent = d3.extent(validValues);
        x = d3.scaleLinear().domain(extent).range([xOffset, xOffset + trackWidth]).nice();
      }

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.1f')))
        .selectAll('text').style('font-size', '9px');

      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(d3.axisTop(x).ticks(5).tickSize(-innerHeight).tickFormat(''))
        .selectAll('line').style('stroke', '#e0e0e0');

      const line = d3.line()
        .defined((d, i) => d != null && isFinite(d) && trackDepth[i] != null)
        .x((d) => x(d))
        .y((_, i) => y(trackDepth[i]));

      g.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('d', line)
        .attr('clip-path', clipId);

      g.append('text')
        .attr('x', xOffset + trackWidth / 2)
        .attr('y', innerHeight + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px').style('font-weight', 'bold')
        .style('fill', color)
        .text(isSaved ? `💾 ${mnemonic}` : mnemonic);
    });

    // ========================================================================
    // EXPRESS-трек: все кривые пористости на ОДНОМ треке
    // ========================================================================
    if (hasExpress) {
      const trackIdx = tracks.length + previewCurvesList.length;
      const xOffset = trackIdx * (trackWidth + trackGap);
      const clipId = `url(#clip-track-${trackIdx})`;
      const trackDepth = porosityExpress.depth;

      // Рамка
      g.append('rect')
        .attr('x', xOffset).attr('y', 0)
        .attr('width', trackWidth).attr('height', innerHeight)
        .attr('fill', 'none').attr('stroke', '#00897B');

      // ===== Fluid zones — полупрозрачные полоски =====
      if (fluidZones && fluidZones.length > 0) {
        for (const zone of fluidZones) {
          const color = FLUID_COLORS[zone.fluid] || FLUID_COLORS.custom;
          const label = FLUID_LABELS[zone.fluid] || 'Custom';
          const yFrom = y(zone.from);
          const yTo = y(zone.to);
          if (!isFinite(yFrom) || !isFinite(yTo)) continue;

          const yTop = Math.min(yFrom, yTo);
          const yHeight = Math.abs(yTo - yFrom);
          if (yHeight < 1) continue;

          // Фоновая полоска
          g.append('rect')
            .attr('x', xOffset)
            .attr('y', yTop)
            .attr('width', trackWidth)
            .attr('height', yHeight)
            .attr('fill', color)
            .attr('opacity', 0.12)
            .attr('stroke', color)
            .attr('stroke-width', 0.5)
            .attr('stroke-opacity', 0.4);

          // Подпись — если полоска достаточно высокая
          if (yHeight > 24) {
            g.append('text')
              .attr('x', xOffset + trackWidth - 4)
              .attr('y', yTop + 11)
              .attr('text-anchor', 'end')
              .style('font-size', '9px')
              .style('font-weight', 'bold')
              .style('fill', color)
              .style('opacity', 0.85)
              .text(`${label} ${zone.rho_fluid.toFixed(2)}`);
          }
        }
      }
      // Ось: 0..0.6
      const x = d3.scaleLinear()
        .domain([0, 0.6])
        .range([xOffset, xOffset + trackWidth]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.1f')))
        .selectAll('text').style('font-size', '9px');

      // Мелкая сетка: нечётные 0.1, 0.3, 0.5 — пунктир
      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(
          d3.axisTop(x)
            .tickValues([0.1, 0.3, 0.5])
            .tickSize(-innerHeight)
            .tickFormat('')
        )
        .selectAll('line')
        .style('stroke', '#c8c8c8')
        .style('stroke-dasharray', '2,4')
        .style('stroke-width', '0.7');

      // Основная сетка: 0, 0.2, 0.4, 0.6 — сплошная
      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(
          d3.axisTop(x)
            .tickValues([0, 0.2, 0.4, 0.6])
            .tickSize(-innerHeight)
            .tickFormat('')
        )
        .selectAll('line')
        .style('stroke', '#a0a0a0')
        .style('stroke-width', '0.9');

      // 4 кривые
      expressCurves.forEach(([mnemonic, curve]) => {
        const values = curve.values || [];
        const color = POROSITY_COLORS[mnemonic] || '#666';

        const line = d3.line()
          .defined((d, i) => d != null && isFinite(d) && trackDepth[i] != null)
          .x((d) => x(d))
          .y((_, i) => y(trackDepth[i]));

        g.append('path')
          .datum(values)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 1.5)
          .attr('d', line)
          .attr('clip-path', clipId);
      });

      // Легенда под треком
      const legendX = xOffset;
      expressCurves.forEach(([mnemonic], i) => {
        const color = POROSITY_COLORS[mnemonic] || '#666';
        g.append('text')
          .attr('x', legendX + i * 38)
          .attr('y', innerHeight + 45)
          .attr('text-anchor', 'start')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style('fill', color)
          .text(mnemonic);
      });

      // Заголовок трека
      g.append('text')
        .attr('x', xOffset + trackWidth / 2)
        .attr('y', innerHeight + 62)
        .attr('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#666')
        .text('Пористость (v/v)');
    }
  }, [wellData, curvesToPlot, units, scale, previewData, porosityExpress, fluidZones, savedTracks]);

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