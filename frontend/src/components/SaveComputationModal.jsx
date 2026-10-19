import React, { useState, useEffect, useRef } from 'react';
import { SaveIcon } from './Icons';

export function SaveComputationModal({
  defaultName,
  method,
  saving,
  error,
  onCancel,
  onConfirm,
}) {
  const [name, setName] = useState(defaultName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !saving;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canSave) onConfirm(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 380, maxWidth: 460 }}
      >
        <div className="modal__header">Сохранить расчёт</div>

        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="label" htmlFor="comp-name">
              Имя расчёта
            </label>
            <input
              ref={inputRef}
              id="comp-name"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              disabled={saving}
            />
            <div
              className="text-xs text-muted"
              style={{ marginTop: 4 }}
            >
              По умолчанию: <code>{defaultName}</code>
              {' · '}
              Метод: <code>{method}</code>
            </div>
          </div>

          {error && (
            <div className="banner banner--error" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}
        </form>

        <div className="modal__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => canSave && onConfirm(trimmed)}
            disabled={!canSave}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <SaveIcon size={14} />
            <span>{saving ? 'Сохранение…' : 'Сохранить'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}