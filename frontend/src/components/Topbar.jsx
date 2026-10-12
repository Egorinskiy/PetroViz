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
}) {
  return (
    <div className="topbar">
      <Logo variant="full" size={24} className="topbar-logo" />
      <FileUpload fileName={fileName} onFileSelect={onFileSelect} />
      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}
      {rightSlot}
    </div>
  );
}