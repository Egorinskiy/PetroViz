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
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!wellData || !curvesToPlot || curvesToPlot.length === 0) return;

    const tracks = buildTracks(curvesToPlot);

    // Геометрия
    const depthExtent = d3.extent(wellData.depth);
    const depthRange = depthExtent[1] - depthExtent[0];
    const innerHeight = computeCanvasHeight(scale, depthRange);

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

    // clipPath для каждого трека
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

    // Треки
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

export default WellLogViewer;