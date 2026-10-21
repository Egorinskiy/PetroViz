import React, { useEffect, useRef } from 'react';

/**
 * Стилизованный диалог ошибки (замена window.alert).
 *
 * Props:
 *   title   — заголовок (по умолчанию «Ошибка»)
 *   message — текст ошибки (если null/пусто — компонент не рендерится)
 *   onClose — вызывается при клике «Понятно», Escape, Enter или клике на фон
 */
export function ErrorModal({ title = 'Ошибка', message, onClose }) {
  const okRef = useRef(null);

  // Автофокус на кнопке
  useEffect(() => {
    if (okRef.current) okRef.current.focus();
  }, []);

  // Escape / Enter → закрыть
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!message) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 2000 }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 360, maxWidth: 520 }}
      >
        <div
          className="modal__header"
          style={{ color: 'var(--color-danger)' }}
        >
          {title}
        </div>

        <div className="modal__body">
          <p
            style={{
              margin: 0,
              fontSize: 'var(--fs-base)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message}
          </p>
        </div>

        <div className="modal__footer">
          <button
            ref={okRef}
            type="button"
            className="btn btn--primary"
            onClick={onClose}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}