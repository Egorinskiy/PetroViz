import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';
import { Logo } from './Logo';
import { ChartIcon } from './Icons';

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
}) {
  return (
    <div className="topbar">
      <Logo variant="full" size={28} className="topbar-logo" />
      <FileUpload fileName={fileName} onFileSelect={onFileSelect} />

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

      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}
      {rightSlot}
    </div>
  );
}