import React from 'react';
import { FileUpload } from './FileUpload';
import { ScaleSelector } from './ScaleSelector';

export function Topbar({ fileName, onFileSelect, scale, onScaleChange, showScale }) {
  return (
    <div className="topbar">
      <h1 className="logo">PetroViz</h1>
      <FileUpload fileName={fileName} onFileSelect={onFileSelect} />
      {showScale && <ScaleSelector value={scale} onChange={onScaleChange} />}
    </div>
  );
}