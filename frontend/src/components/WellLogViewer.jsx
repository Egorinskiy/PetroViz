import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { buildTracks } from './wellLogViewer/buildTracks';
import { drawSingleTrack } from './wellLogViewer/drawSingleTrack';
import { drawCompositeDN } from './wellLogViewer/drawCompositeDN';
import { drawCompositeRes } from './wellLogViewer/drawCompositeRes';
import {
  DEFAULT_SCALE,
  computeCanvasHeight,
  computeGridStep,
  generateDepthTicks,
} from '../constants/depthScales';

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

/**
 * Приводит расчётную кривую к тем же глубинам, что и wellData (прореженные).
 * Использует nearest-index: для каждой глубины из wellDepths находит
 * ближайший по значению индекс в srcDepths.
 *
 * Нужен для того, чтобы расчётные кривые (preview / express / saved) имели
 * ту же детализацию, что и исходные (pixel_width от масштаба).
 */
function _mapToWellDepths(srcDepths, srcValues, wellDepths) {
  if (!srcDepths || !srcValues || !wellDepths) return [];
  const n = srcDepths.length;
  if (n === 0) return new Array(wellDepths.length).fill(null);

  const result = new Array(wellDepths.length);
  let j = 0;
  for (let i = 0; i < wellDepths.length; i++) {
    const d = wellDepths[i];
    // Продвигаем указатель, пока следующая глубина ближе к d
    while (
      j + 1 < n &&
      Math.abs(srcDepths[j + 1] - d) < Math.abs(srcDepths[j] - d)
    ) {
      j++;
    }
    result[i] = srcValues[j] ?? null;
  }
  return result;
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
  gridStep = 'auto',
  topDepth = null,
  bottomDepth = null,
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!wellData || !curvesToPlot || curvesToPlot.length === 0) return;

    const tracks = buildTracks(curvesToPlot);

    // ====================================================================
    // B33: разделяем кривые на специальные (dict) и обычные (array).
    // Специальные (R0, SW, SWI, NTG, PERM) — одна на mnemonic.
    // Обычные (VSH*, PHI*, GR, RHOB...) — может быть несколько с одним
    // mnemonic (например, 3 сохранённых VSH + 1 live VSH).
    // ====================================================================
    const SPECIAL_MNEMONICS = new Set(['R0', 'SW', 'SWI', 'NTG', 'PERM']);
    const specialCurves = {};
    const regularItems = []; // массив пар [mnemonic, item]

    // 1. Live preview
    if (previewData?.curves) {
      for (const [mnemonic, curve] of Object.entries(previewData.curves)) {
        const item = {
          mnemonic,
          values: _mapToWellDepths(
            previewData.depth,
            curve.values,
            wellData.depth
          ),
          depth: wellData.depth,
          isSaved: false,
          isExpress: false,
          key: `live-${mnemonic}`,
        };
        if (SPECIAL_MNEMONICS.has(mnemonic)) {
          if (!specialCurves[mnemonic]) specialCurves[mnemonic] = item;
        } else {
          regularItems.push([mnemonic, item]);
        }
      }
    }

    // 2. Сохранённые расчёты — БЕЗ дедупликации по mnemonic
    for (const t of (savedTracks || [])) {
      const mnemonic = t.label || t.mnemonic;
      const item = {
        mnemonic,
        values: _mapToWellDepths(t.depth, t.values, wellData.depth),
        depth: wellData.depth,
        isSaved: true,
        isExpress: false,
        key: `saved-${t.id}`,
      };
      if (SPECIAL_MNEMONICS.has(mnemonic)) {
        if (!specialCurves[mnemonic]) specialCurves[mnemonic] = item;
      } else {
        regularItems.push([mnemonic, item]);
      }
    }

    // Специальные кривые
    const r0Data = specialCurves['R0'] || null;
    const swData = specialCurves['SW'] || null;
    const swiData = specialCurves['SWI'] || null;
    const ntgData = specialCurves['NTG'] || null;
    const permData = specialCurves['PERM'] || null;

    // Производные флаги (были в старом блоке, потерялись в патче)
    const hasSwSwTrack = !!(swData || swiData);

    // Определяем, есть ли composite_res (для R0 overlay)
    const compositeResTrack = tracks.find((t) => t.type === 'composite_res');
    const hasCompositeRes = !!compositeResTrack;
    const r0AsOverlay = !!(r0Data && hasCompositeRes);

    // R0 есть, но нет ни composite_res, ни отдельных RT-кривых → показать заглушку
    const hasRtInPlot = _hasRtCurve(curvesToPlot);
    const showR0Placeholder = !!(r0Data && !r0AsOverlay && !hasRtInPlot);

  // ====================================================================
    // B33: группировка кривых по категориям
    // ====================================================================
    // Специальные (отдельные треки — не трогаем):
    //   SW, SWI → saturationGroup (свой трек с заливками)
    //   NTG → ntgGroup
    //   PERM → permGroup
    //   R0 (overlay) → внутри composite_res
    //   R0 (placeholder) → заглушка
    //
    // Обычные — группируем:
    //   VSH* → vshaleGroup
    //   PHI* + express → porosityGroup
    //   всё остальное → otherGroup

    // B33: группировка обычных кривых по префиксу mnemonic
    const vshaleGroup = [];
    const porosityGroup = [];
    const otherGroup = [];

    for (const [mnemonic, item] of regularItems) {
      const upper = mnemonic.toUpperCase();
      if (upper.startsWith('VSH')) {
        vshaleGroup.push([mnemonic, item]);
      } else if (upper.startsWith('PHI')) {
        porosityGroup.push([mnemonic, item]);
      } else {
        otherGroup.push([mnemonic, item]);
      }
    }

    // B33: express-пористость добавляем в porosityGroup.
    // B35: мапим на wellData.depth. Не дублируем live preview, но
    // сохранённые PHI остаются рядом (live / saved / express — разные слои).
    if (porosityExpress?.curves && porosityExpress?.depth) {
      for (const [mnemonic, curve] of Object.entries(porosityExpress.curves)) {
        // Пропускаем, если live preview уже дал эту же кривую
        const existsInLive = regularItems.some(
          ([m, it]) => m === mnemonic && !it.isSaved && !it.isExpress
        );
        if (existsInLive) continue;

        porosityGroup.push([
          mnemonic,
          {
            mnemonic,
            values: _mapToWellDepths(
              porosityExpress.depth,
              curve.values,
              wellData.depth
            ),
            depth: wellData.depth,
            isSaved: false,
            isExpress: true,
            isExternal: !!curve.isExternal,
            key: `express-${mnemonic}`,
          },
        ]);
      }
    }

    // ====================================================================
    // ГЕОМЕТРИЯ: Массив ширин треков
    // ====================================================================
    const trackGap = 25;
    const trackWidths = [];

    // 1. Основные треки из LAS (150)
    tracks.forEach(() => trackWidths.push(150));
    // 2. Vshale группа (150)
    if (vshaleGroup.length > 0) trackWidths.push(150);
    // 3. Porosity группа (150) — включает express
    if (porosityGroup.length > 0) trackWidths.push(150);
    // 4. Other группа (150) — обычно пусто
    if (otherGroup.length > 0) trackWidths.push(150);
    // 5. R0 placeholder (150)
    if (showR0Placeholder) trackWidths.push(150);
    // 6. SW/SWI (150)
    if (hasSwSwTrack) trackWidths.push(150);
    // 7. NTG (40 — узкий)
    if (ntgData) trackWidths.push(40);
    // 8. PERM (150)
    if (permData) trackWidths.push(150);

    const totalTracks = trackWidths.length;
    const xOffsets = [];
    let currentX = 0;
    for (let i = 0; i < totalTracks; i++) {
      xOffsets.push(currentX);
      currentX += trackWidths[i] + trackGap;
    }
    const innerWidth = currentX - trackGap;

    // B6: custom диапазон глубин (если задан)
    const fullDepthExtent = d3.extent(wellData.depth);
    const depthExtent = [
      topDepth != null && isFinite(topDepth) ? topDepth : fullDepthExtent[0],
      bottomDepth != null && isFinite(bottomDepth) ? bottomDepth : fullDepthExtent[1],
    ];
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

    const margin = { top: 15, right: 20, bottom: 60, left: 55 };
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

    // B10: шаг сетки
    const effectiveStep =
      gridStep === 'auto' || gridStep == null
        ? computeGridStep(scale, depthRange)
        : Number(gridStep);
    const depthTicks = generateDepthTicks(
      depthExtent[0],
      depthExtent[1],
      effectiveStep
    );

    // Горизонтальная сетка
    g.append('g')
      .call(
        d3.axisLeft(y)
          .tickValues(depthTicks)
          .tickSize(-innerWidth)
          .tickFormat('')
      )
      .selectAll('line')
      .style('stroke', '#d0d0d0')
      .style('stroke-dasharray', '3,2');

    // Ось глубины
    g.append('g')
      .call(
        d3.axisLeft(y)
          .tickValues(depthTicks)
          .tickFormat(d3.format('.0f'))
      )
      .selectAll('text')
      .style('font-size', '11px');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
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

    // 2. Vshale группа
    if (vshaleGroup.length > 0) {
      const idx = currentIdx++;
      drawCurveGroup(
        g,
        vshaleGroup,
        xOffsets[idx],
        trackWidths[idx],
        innerHeight,
        y,
        `url(#clip-track-${idx})`,
        { type: 'vshale', label: 'VSHALE' }
      );
    }

    // 3. Porosity группа (включая express)
    if (porosityGroup.length > 0) {
      const idx = currentIdx++;
      drawCurveGroup(
        g,
        porosityGroup,
        xOffsets[idx],
        trackWidths[idx],
        innerHeight,
        y,
        `url(#clip-track-${idx})`,
        { type: 'porosity', label: 'ПОРИСТОСТЬ' }
      );
    }

    // 4. Other группа
    if (otherGroup.length > 0) {
      const idx = currentIdx++;
      drawCurveGroup(
        g,
        otherGroup,
        xOffsets[idx],
        trackWidths[idx],
        innerHeight,
        y,
        `url(#clip-track-${idx})`,
        { type: 'other', label: 'ПРОЧЕЕ' }
      );
    }

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
  }, [wellData, curvesToPlot, units, scale, previewData, porosityExpress, fluidZones, savedTracks, gridStep, topDepth, bottomDepth]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: '0 1 auto',
      minHeight: 0,
      marginTop: '5px',
    }}>
      <div
        style={{
          flex: '0 1 auto',
          minHeight: 0,
          overflow: 'auto',
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
      .attr('stroke-width', 1.8)
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

// ============================================================================
// B33: группировка кривых на одном треке
// ============================================================================

/**
 * Цвета для групп.
 */
const GROUP_COLORS = {
  vshale: ['#1B5E20', '#00897B', '#4CAF50', '#F9A825', '#0D47A1', '#AD1457'],
  porosity: {
    PHID: '#E65100',
    PHIN: '#0277BD',
    PHI_ND: '#00897B',
    PHIS: '#6A1B9A',
  },
  porosityFallback: ['#E65100', '#0277BD', '#00897B', '#6A1B9A', '#BF360C'],
  external: ['#212121', '#4E342E', '#880E4F', '#37474F', '#1B5E20', '#827717'],
  other: ['#C62828', '#AD1457', '#6A1B9A', '#1565C0', '#00838F'],
};

/**
 * Отрисовывает группу кривых на одном треке.
 *
 * @param {d3.Selection} g
 * @param {Array<[string, {values, depth, isSaved, isExpress, isExternal}]>} group
 * @param {number} xOffset
 * @param {number} trackWidth
 * @param {number} innerHeight
 * @param {d3.ScaleLinear} y
 * @param {string} clipId
 * @param {{type: string, label: string}} options
 */
function drawCurveGroup(g, group, xOffset, trackWidth, innerHeight, y, clipId, options) {
  const { type, label } = options;

  // Рамка трека
  g.append('rect')
    .attr('x', xOffset).attr('y', 0)
    .attr('width', trackWidth).attr('height', innerHeight)
    .attr('fill', 'none')
    .attr('stroke', '#aaa');

  // Определяем ось X по типу группы
  let x;
  if (type === 'vshale') {
    x = d3.scaleLinear().domain([0, 1]).range([xOffset, xOffset + trackWidth]);
  } else if (type === 'porosity') {
    x = d3.scaleLinear().domain([0, 0.6]).range([xOffset, xOffset + trackWidth]);
  } else {
    // other — по фактическому диапазону
    const allVals = group.flatMap(([, item]) =>
      (item.values || []).filter((v) => v != null && isFinite(v))
    );
    if (allVals.length === 0) return;
    const extent = d3.extent(allVals);
    x = d3.scaleLinear().domain(extent).range([xOffset, xOffset + trackWidth]).nice();
  }

  // Ось X снизу
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.1f')))
    .selectAll('text').style('font-size', '9px');

  // Сетка
  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(d3.axisTop(x).ticks(5).tickSize(-innerHeight).tickFormat(''))
    .selectAll('line').style('stroke', '#e0e0e0');

  // Индекс для раскраски
  let colorIndex = 0;
  const externalIndex = {};

  // Рисуем каждую кривую
  group.forEach(([mnemonic, item]) => {
    const { values, depth: trackDepth, isSaved, isExternal, isExpress } = item;

    // Цвет
    let color;
    if (type === 'vshale') {
      color = GROUP_COLORS.vshale[colorIndex % GROUP_COLORS.vshale.length];
      colorIndex++;
    } else if (type === 'porosity') {
      if (GROUP_COLORS.porosity[mnemonic]) {
        color = GROUP_COLORS.porosity[mnemonic];
      } else if (isExternal) {
        const eIdx = externalIndex[mnemonic] ?? Object.keys(externalIndex).length;
        externalIndex[mnemonic] = eIdx;
        color = GROUP_COLORS.external[eIdx % GROUP_COLORS.external.length];
      } else {
        color = GROUP_COLORS.porosityFallback[colorIndex % GROUP_COLORS.porosityFallback.length];
        colorIndex++;
      }
    } else {
      color = GROUP_COLORS.other[colorIndex % GROUP_COLORS.other.length];
      colorIndex++;
    }

    // Стиль линии: live — толстый сплошной, saved — тонкий пунктирный
    const dashArray = isSaved ? '4,2' : 'none';
    const strokeWidth = isExternal
      ? 1.8
      : isSaved
      ? 1.2  // saved — тонкий, «фоновый»
      : 2.0; // live — толстый, доминирует

    const line = d3.line()
      .defined((d, i) => d != null && isFinite(d) && trackDepth[i] != null)
      .x((d) => x(d))
      .y((_, i) => y(trackDepth[i]));

    g.append('path')
      .datum(values)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', strokeWidth)
      .attr('stroke-dasharray', dashArray)
      .attr('d', line)
      .attr('clip-path', clipId);
  });

  // Легенда под треком — все мнемоники в ряд (B37: компактнее)
  const legendY = innerHeight + 32;
  const itemWidth = Math.min(45, trackWidth / Math.max(group.length, 1));
  const startX = xOffset + (trackWidth - itemWidth * group.length) / 2;

  let legendColorIndex = 0;
  const legendExternalIndex = {};

  group.forEach(([mnemonic, item], i) => {
    let color;
    if (type === 'vshale') {
      color = GROUP_COLORS.vshale[legendColorIndex % GROUP_COLORS.vshale.length];
      legendColorIndex++;
    } else if (type === 'porosity') {
      if (GROUP_COLORS.porosity[mnemonic]) {
        color = GROUP_COLORS.porosity[mnemonic];
      } else if (item.isExternal) {
        const eIdx = legendExternalIndex[mnemonic] ?? Object.keys(legendExternalIndex).length;
        legendExternalIndex[mnemonic] = eIdx;
        color = GROUP_COLORS.external[eIdx % GROUP_COLORS.external.length];
      } else {
        color = GROUP_COLORS.porosityFallback[legendColorIndex % GROUP_COLORS.porosityFallback.length];
        legendColorIndex++;
      }
    } else {
      color = GROUP_COLORS.other[legendColorIndex % GROUP_COLORS.other.length];
      legendColorIndex++;
    }

    const short = mnemonic.length > 7 ? mnemonic.slice(0, 6) + '…' : mnemonic;
    g.append('text')
      .attr('x', startX + i * itemWidth + itemWidth / 2)
      .attr('y', legendY)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', color)
      .style('cursor', 'help')
      .text(short)
      .append('title')
      .text(
        `${mnemonic}${item.isSaved ? ' (сохранённый)' : ''}${item.isExternal ? ' (внешняя)' : ''}`
      );
  });

  // Заголовок группы
  g.append('text')
    .attr('x', xOffset + trackWidth / 2)
    .attr('y', innerHeight + 48)
    .attr('text-anchor', 'middle')
    .style('font-size', '9px')
    .style('fill', '#666')
    .text(label);
}

export default WellLogViewer;