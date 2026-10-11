import React from 'react';

export function FileUpload({ fileName, onFileSelect }) {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFileSelect(file);
    e.target.value = ''; // позволяет загрузить тот же файл повторно
  };

  return (
    <label className="file-upload">
      <input type="file" accept=".las" onChange={handleChange} />
      <span className="file-upload-btn">📁 Загрузить LAS</span>
      {fileName && <span className="file-upload-name">{fileName}</span>}
    </label>
  );
}