import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';
import { Logo } from './Logo';
import { ChartIcon, CurvesIcon } from './Icons';

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
}) {
  return (
    <div className="topbar">
      <Logo variant="text" size={32} className="topbar-logo" />
      <FileUpload fileName={fileName} onFileSelect={onFileSelect} />

      {showCurvesButton && (
        <button
          className={`btn ${
            curvesVisible ? 'btn--primary' : 'btn--secondary'
          }`}
          onClick={onToggleCurves}
          title={
            curvesVisible
              ? 'Скрыть блок выбора кривых'
              : 'Показать блок выбора кривых'
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CurvesIcon size={16} />
          <span>Кривые</span>
        </button>
      )}

      {showComputations && (
        <button
          className={`btn ${
            computationsOpen ? 'btn--primary' : 'btn--secondary'
          }`}
          onClick={onToggleComputations}
          title="Панель петрофизических расчётов"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ChartIcon size={16} />
          <span>Расчёты</span>
        </button>
      )}

      {wellName && (
        <div className="topbar-well" title={wellName}>
          <span className="topbar-well-name">{wellName}</span>
          {showSharedBadge && (
            <span className="badge badge--shared">shared</span>
          )}
        </div>
      )}

      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}
      {rightSlot}
    </div>
  );
}