import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  getCurveFamily,
  isServiceCurve,
  RESISTIVITY_FAMILIES,
} from '../constants/curveFamilies';
import { getCurveStyle, SERVICE_STYLE, CURVE_STYLES } from '../constants/curveStyles';
import {
  DEFAULT_SCALE,
  computeCanvasHeight,
} from '../constants/depthScales';

// --- Утилиты ---

function percentile(arr, p) {
  const sorted = arr.slice().sort(d3.ascending);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function robustDomain(values, hardDomain) {
  if (hardDomain) return hardDomain;
  const valid = values.filter((v) => v != null && isFinite(v));
  if (valid.length === 0) return [0, 1];
  const p1 = percentile(valid, 0.01);
  const p99 = percentile(valid, 0.99);
  if (p1 === p99) return [p1 - 1, p99 + 1];
  return [p1, p99];
}

// Формат тиков оси X: без экспоненты до 5 знаков
function formatLinearTick(v) {
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1000) return d3.format(',.0f')(v);
  if (abs >= 10) return d3.format('.0f')(v);
  if (abs >= 1) return d3.format('.2f')(v);
  return d3.format('.3g')(v);
}

function buildTracks(curvesToPlot) {
  const tracks = [];
  let densityCurve = null;
  let neutronCurve = null;
  const resistivityCurves = [];

  for (const curve of curvesToPlot) {
    const family = getCurveFamily(curve);
    if (family === 'RHOB' && !densityCurve) densityCurve = curve;
    else if (family === 'NPHI' && !neutronCurve) neutronCurve = curve;
    else if (family && RESISTIVITY_FAMILIES.has(family)) resistivityCurves.push(curve);
    else tracks.push({ type: 'single', curves: [curve], family });
  }

  if (densityCurve && neutronCurve) {
    tracks.push({ type: 'composite_dn', curves: [densityCurve, neutronCurve] });
  } else {
    if (densityCurve) tracks.push({ type: 'single', curves: [densityCurve], family: 'RHOB' });
    if (neutronCurve) tracks.push({ type: 'single', curves: [neutronCurve], family: 'NPHI' });
  }

  if (resistivityCurves.length > 0) {
    tracks.push({ type: 'composite_res', curves: resistivityCurves });
  }

  return tracks;
}

const WellLogViewer = ({
  wellData,
  curvesToPlot,
  units = {},
  scale = DEFAULT_SCALE,
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!wellData || !curvesToPlot || curvesToPlot.length === 0) return;

    const tracks = buildTracks(curvesToPlot);

    // --- Геометрия ---
    const depthExtent = d3.extent(wellData.depth);
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

    // top уменьшен (NPHI переехала вниз), bottom увеличен (две линейки + подписи)
    const margin = { top: 25, right: 30, bottom: 130, left: 80 };
    const trackWidth = 150;
    const trackGap = 25;
    const innerWidth = tracks.length * (trackWidth + trackGap);
    const totalWidth = innerWidth + margin.left + margin.right;
    const totalHeight = innerHeight + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', totalWidth).attr('height', totalHeight);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = svg.append('defs');
    tracks.forEach((_, idx) => {
      const xOffset = idx * (trackWidth + trackGap);
      defs
        .append('clipPath')
        .attr('id', `clip-track-${idx}`)
        .append('rect')
        .attr('x', xOffset)
        .attr('y', 0)
        .attr('width', trackWidth)
        .attr('height', innerHeight);
    });

    const y = d3.scaleLinear().domain(depthExtent).range([0, innerHeight]);

    // --- Горизонтальная сетка ---
    g.append('g')
      .call(d3.axisLeft(y).ticks(12).tickSize(-innerWidth).tickFormat(''))
      .selectAll('line')
      .style('stroke', '#d0d0d0')
      .style('stroke-dasharray', '3,2');

    // --- Ось глубины ---
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

    // --- Рисуем треки ---
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
  }, [wellData, curvesToPlot, units, scale]);

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

// ==== Одиночный трек ====

function drawSingleTrack(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId, units) {
  const curve = track.curves[0];
  const family = track.family;
  const style = isServiceCurve(curve) ? SERVICE_STYLE : getCurveStyle(family, 0);

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

// ==== Composite RHOB + NPHI ====

function drawCompositeDN(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId) {
  const [densityCurve, neutronCurve] = track.curves;

  const dStyle = CURVE_STYLES.RHOB;
  const nStyle = CURVE_STYLES.NPHI;

  const xDensity = d3
    .scaleLinear()
    .domain(dStyle.domain)     // [1.84, 2.68]
    .range([xOffset, xOffset + trackWidth]);

  const xNeutron = d3
    .scaleLinear()
    .domain(nStyle.domain)     // [0.5, 0]
    .range([xOffset, xOffset + trackWidth]);

  // --- Обе линейки СНИЗУ, стопкой ---
  // Верхняя (ближе к треку) — RHOB (красная)
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xDensity).ticks(4).tickFormat(d3.format('.2f')))
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', dStyle.color);

  // Нижняя (на 28 px ниже) — NPHI (синяя)
  g.append('g')
    .attr('transform', `translate(0,${innerHeight + 28})`)
    .call(d3.axisBottom(xNeutron).ticks(4).tickFormat(d3.format('.2f')))
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', nStyle.color);

  // Подписи под обеими линейками
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

   g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(
      d3
        .axisTop(xNeutron)
        .ticks(4)
        .tickSize(-innerHeight)
        .tickFormat('')
    )
    .selectAll('line')
    .style('stroke', '#e0e0e0');

  // --- Данные ---
  const depValues = wellData[densityCurve] || [];
  const neuValues = wellData[neutronCurve] || [];
  const depth = wellData.depth;

  // Разбиваем на сегменты, где плотность левее нейтрона
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

// ==== Composite всех УЭС ====

function drawCompositeRes(g, track, xOffset, trackWidth, innerHeight, y, wellData, clipId, units) {
  const allPositive = [];
  track.curves.forEach((curve) => {
    const values = wellData[curve] || [];
    values.forEach((v) => {
      if (v != null && isFinite(v) && v > 0) allPositive.push(v);
    });
  });

  if (allPositive.length === 0) {
    track.curves.forEach((curve, i) => {
      const style = getCurveStyle(getCurveFamily(curve), i);
      drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units);
    });
    drawNoData(g, xOffset, trackWidth, innerHeight, track.curves[0]);
    return;
  }

  const [dMin, dMax] = d3.extent(allPositive);
  const x = d3
    .scaleLog()
    .domain([Math.max(dMin * 0.5, 0.001), dMax * 2])
    .range([xOffset, xOffset + trackWidth]);

    // Ось X снизу (лог)
  const logAxis = d3.axisBottom(x).ticks(3, '~g');
  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(logAxis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', '#333');

  // 👇 Сетка по лог-шкале
  g.append('g')
    .attr('transform', `translate(0,0)`)
    .call(
      d3
        .axisTop(x)
        .ticks(3, '~g')
        .tickSize(-innerHeight)
        .tickFormat('')
    )
    .selectAll('line')
    .style('stroke', '#e0e0e0');

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

// ==== Утилиты рисования ====

function drawXAxis(g, x, xOffset, trackWidth, innerHeight, useLog, color) {
  const axis = useLog
    ? d3.axisBottom(x).ticks(3, '~g')
    : d3.axisBottom(x).ticks(5).tickFormat(formatLinearTick);

  g.append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(axis)
    .selectAll('text')
    .style('font-size', '9px')
    .style('fill', color || '#333');

  // Вертикальная сетка (ярче)
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

function drawTrackLabel(g, xOffset, trackWidth, innerHeight, curve, style, units) {
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

function drawNoData(g, xOffset, trackWidth, innerHeight, curve) {
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

export default WellLogViewer;