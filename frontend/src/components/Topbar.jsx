import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';
import { Logo } from './Logo';
import { ChartIcon, CurvesIcon } from './Icons';
import { GridStepSelect } from './GridStepSelect';
import { DepthRangePicker } from './DepthRangePicker';

export function Topbar({
  fileName,
  onFileSelect,
  scale,
  onScaleChange,
  showScale,
  rightSlot = null,
  showComputations = false,
  computationsOpen = false,
  onToggleComputations,
  showCurvesButton = false,
  curvesVisible = true,
  onToggleCurves,
  wellName = null,
  showSharedBadge = false,
  gridStep = 'auto',
  onGridStepChange,
  minDepth = null,
  maxDepth = null,
  depthRange = null,
  onDepthRangeChange,
}) {
  return (
    <div className="topbar">
      <Logo variant="text" size={32} className="topbar-logo" />

      <div className="topbar-sep" />

      <FileUpload fileName={fileName} onFileSelect={onFileSelect} />

      {showCurvesButton && (
        <button
          className={`btn ${curvesVisible ? 'btn--primary' : 'btn--secondary'}`}
          onClick={onToggleCurves}
          title={
            curvesVisible
              ? 'Скрыть блок выбора кривых'
              : 'Показать блок выбора кривых'
          }
        >
          <CurvesIcon size={16} />
          <span>Кривые</span>
        </button>
      )}

      {showComputations && (
        <button
          className={`btn ${computationsOpen ? 'btn--primary' : 'btn--secondary'}`}
          onClick={onToggleComputations}
          title="Панель петрофизических расчётов"
        >
          <ChartIcon size={16} />
          <span>Расчёты</span>
        </button>
      )}

      {wellName && (
        <>
          <div className="topbar-sep" />
          <div className="topbar-well-block" title={wellName}>
            <span className="well-name">{wellName}</span>
            {showSharedBadge && (
              <span className="badge badge--shared">shared</span>
            )}
          </div>
        </>
      )}

      <div className="topbar-spacer" />

      {showScale && onGridStepChange && (
        <GridStepSelect value={gridStep} onChange={onGridStepChange} />
      )}

      {showScale && onDepthRangeChange && minDepth != null && maxDepth != null && (
        <DepthRangePicker
          minDepth={minDepth}
          maxDepth={maxDepth}
          value={depthRange}
          onChange={onDepthRangeChange}
        />
      )}

      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}

      {rightSlot && (
        <>
          <div className="topbar-sep" />
          {rightSlot}
        </>
      )}
    </div>
  );
}