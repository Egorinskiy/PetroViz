import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';
import { Logo } from './Logo';

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
          className={`btn btn--sm ${
            computationsOpen ? 'btn--primary' : 'btn--secondary'
          }`}
          onClick={onToggleComputations}
          title="Панель петрофизических расчётов"
        >
          📊 Расчёты
        </button>
      )}

      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}
      {rightSlot}
    </div>
  );
}