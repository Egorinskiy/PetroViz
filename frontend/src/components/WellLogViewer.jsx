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

// Цвета/подписи fluid zones
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

// Известные префиксы УЭС (для проверки «есть ли RT на планшете»)
const RT_PREFIXES = [
  'RDEP', 'RSHA', 'RMED', 'RXO', 'RMIC',
  'RT', 'ILD', 'LLD', 'LLS', 'RES',
  'RLLD', 'RLLS', 'RILD', 'RILM', 'RI', 'RID', 'RIS',
];

function _isRtCurve(name) {
  const u = String(name).toUpperCase();
  // Не путать с RHOB (плотность)
  if (u.startsWith('RH')) return false;
  return RT_PREFIXES.some((p) => u.startsWith(p));
}

function _hasRtCurve(curvesToPlot) {
  return (curvesToPlot || []).some(_isRtCurve);
}

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

    // ====================================================================
    // Собираем все preview-кривые (live + saved) в словарь по mnemonic
    // ====================================================================
    const allCurves = {};
    if (previewData?.curves) {
      for (const [mnemonic, curve] of Object.entries(previewData.curves)) {
        allCurves[mnemonic] = {
          mnemonic,
          values: curve.values,
          depth: previewData.depth,
          isSaved: false,
          key: `live-${mnemonic}`,
        };
      }
    }
    for (const t of (savedTracks || [])) {
      const mnemonic = t.label || t.mnemonic;
      if (!allCurves[mnemonic]) {
        allCurves[mnemonic] = {
          mnemonic,
          values: t.values,
          depth: t.depth,
          isSaved: true,
          key: `saved-${t.id}`,
        };
      }
    }

    // Специальные кривые
    const r0Data = allCurves['R0'] || null;
    const swData = allCurves['SW'] || null;
    const swiData = allCurves['SWI'] || null;
    const ntgData = allCurves['NTG'] || null;
    const permData = allCurves['PERM'] || null;
    const hasSwSwTrack = !!(swData || swiData);

    // Определяем, есть ли composite_res (для R0 overlay)
    const compositeResTrack = tracks.find((t) => t.type === 'composite_res');
    const hasCompositeRes = !!compositeResTrack;
    const r0AsOverlay = !!(r0Data && hasCompositeRes);

    // R0 есть, но нет ни composite_res, ни отдельных RT-кривых → показать заглушку
    const hasRtInPlot = _hasRtCurve(curvesToPlot);
    const showR0Placeholder = !!(r0Data && !r0AsOverlay && !hasRtInPlot);

    // Обычные preview-кривые (всё кроме специальных)
    const regularCurves = Object.entries(allCurves).filter(([m]) => {
      if (m === 'SW' || m === 'SWI') return false;
      if (m === 'NTG' || m === 'PERM') return false;
      if (m === 'R0' && r0AsOverlay) return false;
      if (m === 'R0' && showR0Placeholder) return false; // вместо трека — заглушка
      return true;
    });

    // Express-трек
    const expressCurves = porosityExpress?.curves
      ? Object.entries(porosityExpress.curves)
      : [];
    const hasExpress = expressCurves.length > 0 && porosityExpress?.depth;

    // ====================================================================
    // ГЕОМЕТРИЯ: Массив ширин треков
    // ====================================================================
    const trackGap = 25;
    const trackWidths = [];

    // 1. Основные треки (стандарт 150)
    tracks.forEach(() => trackWidths.push(150));
    // 2. Обычные preview (150)
    regularCurves.forEach(() => trackWidths.push(150));
    // 2.5. R0 placeholder (150) — если R0 есть, но нет RT на планшете
    if (showR0Placeholder) trackWidths.push(150);
    // 3. SW/SWI (150)
    if (hasSwSwTrack) trackWidths.push(150);
    // 4. NTG (40 — узкий)
    if (ntgData) trackWidths.push(40);
    // 5. PERM (150)
    if (permData) trackWidths.push(150);
    // 6. EXPRESS (150)
    if (hasExpress) trackWidths.push(150);

    const totalTracks = trackWidths.length;
    const xOffsets = [];
    let currentX = 0;
    for (let i = 0; i < totalTracks; i++) {
      xOffsets.push(currentX);
      currentX += trackWidths[i] + trackGap;
    }
    const innerWidth = currentX - trackGap;

    const depthExtent = d3.extent(wellData.depth);
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

    const margin = { top: 25, right: 30, bottom: 130, left: 80 };
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
      defs
        .append('clipPath')
        .attr('id', `clip-track-${idx}`)
        .append('rect')
        .attr('x', xOffsets[idx])
        .attr('y', 0)
        .attr('width', trackWidths[idx])
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

    // ====================================================================
    // Рисование
    // ====================================================================

    let currentIdx = 0;

    // 1. Основные треки каротажа (+ R0 overlay)
    tracks.forEach((track, i) => {
      const idx = currentIdx++;
      const xOffset = xOffsets[idx];
      const trackW = trackWidths[idx];
      const clipId = `url(#clip-track-${idx})`;

      g.append('rect')
        .attr('x', xOffset)
        .attr('y', 0)
        .attr('width', trackW)
        .attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('stroke', '#aaa');

      if (track.type === 'composite_dn') {
        drawCompositeDN(g, track, xOffset, trackW, innerHeight, y, wellData, clipId);
      } else if (track.type === 'composite_res') {
        drawCompositeRes(
          g, track, xOffset, trackW, innerHeight, y,
          wellData, clipId, units,
          r0AsOverlay ? r0Data : null
        );
      } else {
        drawSingleTrack(g, track, xOffset, trackW, innerHeight, y, wellData, clipId, units);
      }
    });

    // 2. Обычные preview-треки
    regularCurves.forEach(([mnemonic, item]) => {
      const idx = currentIdx++;
      const { values, depth: trackDepth, isSaved } = item;
      const xOffset = xOffsets[idx];
      const trackW = trackWidths[idx];
      const clipId = `url(#clip-track-${idx})`;

      g.append('rect')
        .attr('x', xOffset).attr('y', 0)
        .attr('width', trackW).attr('height', innerHeight)
        .attr('fill', 'none')
        .attr('stroke', isSaved ? '#1565c0' : '#aaa');

      const validValues = (values || []).filter((v) => v != null && isFinite(v));
      if (validValues.length === 0) {
        g.append('text')
          .attr('x', xOffset + trackW / 2)
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
      if (isSaved) color = '#1565c0';
      else if (isVshale) color = '#388e3c';
      else if (upper === 'PHI_ND') color = '#00897B';
      else if (upper.startsWith('PHID')) color = '#E65100';
      else if (upper.startsWith('PHIN')) color = '#0277BD';
      else if (upper.startsWith('PHIS')) color = '#6A1B9A';
      else if (isPorosity) color = '#E65100';
      else if (isSaturation) color = '#1565c0';
      else color = '#C62828';

      let x;
      if (isVshale || isSaturation) {
        x = d3.scaleLinear().domain([0, 1]).range([xOffset, xOffset + trackW]);
      } else if (isPorosity) {
        x = d3.scaleLinear().domain([0, 0.6]).range([xOffset, xOffset + trackW]);
      } else {
        const extent = d3.extent(validValues);
        x = d3.scaleLinear().domain(extent).range([xOffset, xOffset + trackW]).nice();
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
        .attr('x', xOffset + trackW / 2)
        .attr('y', innerHeight + 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px').style('font-weight', 'bold')
        .style('fill', color)
        .text(isSaved ? `💾 ${mnemonic}` : mnemonic);
    });

    // 2.5. R0 placeholder — R0 есть, но не с чем сравнивать
    if (showR0Placeholder) {
      const idx = currentIdx++;
      drawR0Placeholder(g, xOffsets[idx], trackWidths[idx], innerHeight);
    }

    // 3. SW/SWI
    if (hasSwSwTrack) {
      const idx = currentIdx++;
      drawSwSwTrack(g, swData, swiData, xOffsets[idx], trackWidths[idx], innerHeight, y, `url(#clip-track-${idx})`);
    }

    // 4. NTG
    if (ntgData) {
      const idx = currentIdx++;
      drawNtgTrack(g, ntgData, xOffsets[idx], trackWidths[idx], innerHeight, y, `url(#clip-track-${idx})`);
    }

    // 5. PERM
    if (permData) {
      const idx = currentIdx++;
      drawPermTrack(g, permData, xOffsets[idx], trackWidths[idx], innerHeight, y, `url(#clip-track-${idx})`);
    }

    // 6. EXPRESS
    if (hasExpress) {
      const idx = currentIdx++;
      const xOffset = xOffsets[idx];
      const trackW = trackWidths[idx];
      const clipId = `url(#clip-track-${idx})`;
      const trackDepth = porosityExpress.depth;

      g.append('rect')
        .attr('x', xOffset).attr('y', 0)
        .attr('width', trackW).attr('height', innerHeight)
        .attr('fill', 'none').attr('stroke', '#00897B');

      const x = d3.scaleLinear()
        .domain([0, 0.6])
        .range([xOffset, xOffset + trackW]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('.1f')))
        .selectAll('text').style('font-size', '9px');

      // Мелкая сетка 0.1, 0.3, 0.5
      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(d3.axisTop(x).tickValues([0.1, 0.3, 0.5]).tickSize(-innerHeight).tickFormat(''))
        .selectAll('line')
        .style('stroke', '#c8c8c8')
        .style('stroke-dasharray', '2,4')
        .style('stroke-width', '0.7');

      // Основная 0.0, 0.2, 0.4, 0.6
      g.append('g')
        .attr('transform', `translate(0,0)`)
        .call(d3.axisTop(x).tickValues([0, 0.2, 0.4, 0.6]).tickSize(-innerHeight).tickFormat(''))
        .selectAll('line')
        .style('stroke', '#a0a0a0')
        .style('stroke-width', '0.9');

      // Внешние цвета — та же палитра, что в usePorosityExpress.js
      const EXTERNAL_COLORS = [
        '#212121', '#4E342E', '#880E4F', '#37474F', '#1B5E20', '#827717',
      ];
      const externalIndex = {};

      expressCurves.forEach(([mnemonic, curve]) => {
        const values = curve.values || [];
        const isExternal = !!curve.isExternal;
        let color;
        if (POROSITY_COLORS[mnemonic]) {
          color = POROSITY_COLORS[mnemonic];
        } else {
          // Внешняя — цвет из резерва, индекс по порядку
          const idx = externalIndex[mnemonic] ?? Object.keys(externalIndex).length;
          externalIndex[mnemonic] = idx;
          color = EXTERNAL_COLORS[idx % EXTERNAL_COLORS.length];
        }

        const line = d3.line()
          .defined((d, i) => d != null && isFinite(d) && trackDepth[i] != null)
          .x((d) => x(d))
          .y((_, i) => y(trackDepth[i]));

        g.append('path')
          .datum(values)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', isExternal ? 1.8 : 1.5)
          .attr('d', line)
          .attr('clip-path', clipId);
      });

      const legendX = xOffset;
      expressCurves.forEach(([mnemonic], i) => {
        const isExternal = !!expressCurves[i][1].isExternal;
        let color;
        if (POROSITY_COLORS[mnemonic]) {
          color = POROSITY_COLORS[mnemonic];
        } else {
          const idx = expressCurves
            .slice(0, i + 1)
            .filter(([m]) => !POROSITY_COLORS[m])
            .map(([m]) => m)
            .indexOf(mnemonic);
          color = EXTERNAL_COLORS[idx % EXTERNAL_COLORS.length];
        }

        const label = isExternal ? `${mnemonic}*` : mnemonic;
        g.append('text')
          .attr('x', legendX + i * 42)
          .attr('y', innerHeight + 45)
          .attr('text-anchor', 'start')
          .style('font-size', '10px')
          .style('font-weight', 'bold')
          .style('fill', color)
          .text(label)
          .append('title')
          .text(isExternal ? `${mnemonic} (внешняя)` : mnemonic);
      });

      g.append('text')
        .attr('x', xOffset + trackW / 2)
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

// ============================================================================
// Вспомогательные функции отрисовки (с поддержкой динамической ширины)
// ============================================================================

function drawSwSwTrack(g, swData, swiData, xOffset, trackWidth, innerHeight, y, clipId) {
  g.append('rect')
    .attr('x', xOffset).attr('y', 0)
    .attr('width', trackWidth).attr('height', innerHeight)
    .attr('fill', 'none').attr('stroke', '#333');

  const x = d3.scaleLinear()
    .domain([1, 0])
    .range([xOffset, xOffset + trackWidth]);

  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(d3.axisTop(x).tickValues([1, 0.8, 0.6, 0.4, 0.2, 0]).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#e0e0e0');

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues([1, 0.8, 0.6, 0.4, 0.2, 0]).tickFormat(d3.format('.1f')))
    .selectAll('text').style('font-size', '9px');

  if (swData?.values && swData.values.length > 0) {
    const swFill = d3.area()
      .x0(() => xOffset)
      .x1((d) => x(d))
      .y((_, i) => y(swData.depth[i]))
      .defined((d, i) => d != null && isFinite(d) && swData.depth[i] != null);

    g.append('path')
      .datum(swData.values)
      .attr('d', swFill)
      .attr('fill', '#C62828')
      .attr('fill-opacity', 0.25)
      .attr('clip-path', clipId);

    const swLine = d3.line()
      .defined((d, i) => d != null && isFinite(d) && swData.depth[i] != null)
      .x((d) => x(d))
      .y((_, i) => y(swData.depth[i]));

    g.append('path')
      .datum(swData.values)
      .attr('fill', 'none')
      .attr('stroke', '#1565C0')
      .attr('stroke-width', 2.5)
      .attr('d', swLine)
      .attr('clip-path', clipId);
  }

  if (swiData?.values && swiData.values.length > 0) {
    const swiFill = d3.area()
      .x0((d) => x(d))
      .x1(() => xOffset + trackWidth)
      .y((_, i) => y(swiData.depth[i]))
      .defined((d, i) => d != null && isFinite(d) && swiData.depth[i] != null);

    g.append('path')
      .datum(swiData.values)
      .attr('d', swiFill)
      .attr('fill', '#00838F')
      .attr('fill-opacity', 0.3)
      .attr('clip-path', clipId);

    const swiLine = d3.line()
      .defined((d, i) => d != null && isFinite(d) && swiData.depth[i] != null)
      .x((d) => x(d))
      .y((_, i) => y(swiData.depth[i]));

    g.append('path')
      .datum(swiData.values)
      .attr('fill', 'none')
      .attr('stroke', '#000000')
      .attr('stroke-width', 1)
      .attr('d', swiLine)
      .attr('clip-path', clipId);
  }

  const label = swData && swiData ? 'SW / SWI' : swData ? 'SW' : 'SWI';
  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#333')
    .text(label);
}

function drawNtgTrack(g, ntgData, xOffset, trackWidth, innerHeight, y, clipId) {
  g.append('rect')
    .attr('x', xOffset).attr('y', 0)
    .attr('width', trackWidth).attr('height', innerHeight)
    .attr('fill', 'none').attr('stroke', '#F9A825'); // Жёлто-оранжевая рамка

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([xOffset, xOffset + trackWidth]);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickValues([0, 1]).tickFormat(d3.format('d')))
    .selectAll('text').style('font-size', '9px');

  // Заливка коллекторов (жёлтая)
  const ntgFill = d3.area()
    .x0(() => xOffset)
    .x1((d) => x(d))
    .y((_, i) => y(ntgData.depth[i]))
    .defined((d, i) => d != null && isFinite(d) && d === 1 && ntgData.depth[i] != null);

  g.append('path')
    .datum(ntgData.values)
    .attr('d', ntgFill)
    .attr('fill', '#FDD835') // Ярко-жёлтый
    .attr('fill-opacity', 0.5)
    .attr('clip-path', clipId);

  // Ступенчатая линия
  const line = d3.line()
    .defined((d, i) => d != null && isFinite(d) && ntgData.depth[i] != null)
    .curve(d3.curveStepAfter)
    .x((d) => x(d))
    .y((_, i) => y(ntgData.depth[i]));

  g.append('path')
    .datum(ntgData.values)
    .attr('fill', 'none')
    .attr('stroke', '#F57F17') // Тёмно-жёлтый/оранжевый
    .attr('stroke-width', 1.5)
    .attr('d', line)
    .attr('clip-path', clipId);

  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '10px')
    .style('font-weight', 'bold')
    .style('fill', '#F57F17')
    .text('NTG');
}

function drawPermTrack(g, permData, xOffset, trackWidth, innerHeight, y, clipId) {
  g.append('rect')
    .attr('x', xOffset).attr('y', 0)
    .attr('width', trackWidth).attr('height', innerHeight)
    .attr('fill', 'none').attr('stroke', '#8D6E63');

  const x = d3.scaleLog()
    .domain([0.01, 10000])
    .range([xOffset, xOffset + trackWidth]);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(4, '~g'))
    .selectAll('text').style('font-size', '9px');

  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(d3.axisTop(x).ticks(4, '~g').tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#e0e0e0');

  const line = d3.line()
    .defined((d, i) => d != null && isFinite(d) && d > 0 && permData.depth[i] != null)
    .x((d) => x(d))
    .y((_, i) => y(permData.depth[i]));

  g.append('path')
    .datum(permData.values)
    .attr('fill', 'none')
    .attr('stroke', '#D84315')
    .attr('stroke-width', 1.5)
    .attr('d', line)
    .attr('clip-path', clipId);

  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#D84315')
    .text('PERM');
}

function drawR0Placeholder(g, xOffset, trackWidth, innerHeight) {
  // Фоновая заливка + пунктирная рамка
  g.append('rect')
    .attr('x', xOffset).attr('y', 0)
    .attr('width', trackWidth).attr('height', innerHeight)
    .attr('fill', '#f0f0f0')
    .attr('stroke', '#bbb')
    .attr('stroke-dasharray', '4,3');

  // Лёгкая диагональная штриховка (намёк на «пусто»)
  const hatch = 12;
  for (let y0 = -trackWidth; y0 < innerHeight + trackWidth; y0 += hatch) {
    g.append('line')
      .attr('x1', xOffset)
      .attr('y1', y0)
      .attr('x2', xOffset + trackWidth)
      .attr('y2', y0 + trackWidth)
      .attr('stroke', '#e4e4e4')
      .attr('stroke-width', 1);
  }

  // Вертикальный текст по центру (две строки)
  const cx = xOffset + trackWidth / 2;
  const cy = innerHeight / 2;

  const text = g.append('text')
    .attr('transform', `translate(${cx}, ${cy}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('fill', '#888')
    .style('font-style', 'italic');

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '-0.6em')
    .text('Добавьте кривую УЭС на планшет');

  text.append('tspan')
    .attr('x', 0)
    .attr('dy', '1.2em')
    .text('для настройки модели R0');

  // Подпись трека под осью
  g.append('text')
    .attr('x', cx)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#999')
    .text('R0');
}

export default WellLogViewer;