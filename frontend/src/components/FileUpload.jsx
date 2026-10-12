import React from 'react';

export function FileUpload({ fileName, onFileSelect }) {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
    e.target.value = '';
  };

  return (
    <label className="file-upload">
      <input type="file" accept=".las" onChange={handleChange} />
      <span className="btn btn--primary">
        📁 Загрузить LAS
      </span>
      {fileName && <span className="file-upload-name text-sm text-muted">{fileName}</span>}
    </label>
  );
}