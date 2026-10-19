import React, { useRef } from 'react';
import { UploadIcon } from './Icons';

export function FileUpload({ fileName, onFileSelect }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Сброс, чтобы можно было выбрать тот же файл ещё раз
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <label
      className="btn btn--primary file-upload"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".las,.LAS"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <UploadIcon size={16} />
      <span>{fileName || 'Загрузить LAS'}</span>
    </label>
  );
}