import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';
import { Logo } from './Logo';
import { ChartIcon, CurvesIcon, SaveIcon } from './Icons';
import { ExportMenu } from './ExportMenu';
import { GridStepSelect } from './GridStepSelect';
import { DepthRangePicker } from './DepthRangePicker';

// Псевдоним для читаемости в Topbar
const SavePadIcon = SaveIcon;

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
  // B29
  onSavePad,
  saveFlash = false,
  restoreBadge = false,
  // B42/B44
  onExport,
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

      {onExport && (
        <>
          <div className="topbar-sep" />
          <ExportMenu onExport={onExport} />
        </>
      )}

      {onSavePad && (
        <>
          <div className="topbar-sep" />
          <button
            className={`btn ${saveFlash ? 'btn--primary' : 'btn--secondary'}`}
            onClick={onSavePad}
            title="Сохранить текущий вид планшета"
            style={{
              minWidth: 150,
              justifyContent: 'center',
            }}
          >
            {saveFlash ? (
              <>
                <span style={{ fontSize: 14 }}>✓</span>
                <span>Сохранено</span>
              </>
            ) : (
              <>
                <SavePadIcon size={16} />
                <span>Сохранить</span>
              </>
            )}
          </button>
          {restoreBadge && (
            <span
              className="badge badge--success"
              style={{
                animation: 'fadeInOut 3s ease-in-out',
              }}
            >
              Восстановлено
            </span>
          )}
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