import React, { useEffect, useRef } from 'react';

/**
 * Универсальный диалог подтверждения в стиле дизайн-системы.
 *
 * Props:
 *   title        — заголовок (по умолчанию «Подтверждение»)
 *   message      — текст или ReactNode
 *   confirmLabel — текст кнопки подтверждения (по умолчанию «OK»)
 *   cancelLabel  — текст кнопки отмены (по умолчанию «Отмена»)
 *   danger       — если true, кнопка подтверждения красная
 *   loading      — блокирует кнопки и показывает «…»
 *   onCancel     — вызывается при отмене (Escape, клик на фон, кнопка)
 *   onConfirm    — вызывается при подтверждении (Enter, кнопка)
 */
export function ConfirmDialog({
  title = 'Подтверждение',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const cancelRef = useRef(null);

  // Автофокус на безопасной кнопке
  useEffect(() => {
    if (cancelRef.current) cancelRef.current.focus();
  }, []);

  // Escape → отмена, Enter → подтверждение
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        onConfirm?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [loading, onCancel, onConfirm]);

  const confirmClass = danger ? 'btn btn--danger' : 'btn btn--primary';

  return (
    <div
      className="modal-overlay"
      onClick={loading ? undefined : onCancel}
      style={{ zIndex: 2000 }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 360, maxWidth: 460 }}
      >
        <div className="modal__header">{title}</div>

        <div className="modal__body">
          {message}
        </div>

        <div className="modal__footer">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}