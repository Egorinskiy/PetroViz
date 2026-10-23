import React, { useState, useEffect, useRef } from 'react';
import { DownloadIcon } from './Icons';

/**
 * Кнопка «Экспорт» с dropdown выбора формата (B44).
 */
export function ExportMenu({ onExport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (format) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div className="export-menu" ref={ref}>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={() => setOpen((o) => !o)}
        title="Экспорт в LAS / CSV"
      >
        <DownloadIcon size={16} />
        <span>Экспорт</span>
        <span
          className="export-menu__caret"
          style={{
            fontSize: 9,
            marginLeft: 2,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
            display: 'inline-block',
          }}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="export-menu__dropdown">
          <button
            type="button"
            className="export-menu__item"
            onClick={() => pick('las')}
          >
            <span className="export-menu__ext">.las</span>
            <span className="export-menu__label">
              LAS (Techlog, Geolog, IP)
            </span>
          </button>
          <button
            type="button"
            className="export-menu__item"
            onClick={() => pick('csv')}
          >
            <span className="export-menu__ext">.csv</span>
            <span className="export-menu__label">
              CSV (Excel, pandas, R)
            </span>
          </button>
          <button
            type="button"
            className="export-menu__item"
            onClick={() => pick('pdf')}
          >
            <span className="export-menu__ext">.pdf</span>
            <span className="export-menu__label">
              PDF (отчёт 1:1 с планшетом)
            </span>
          </button>
        </div>
      )}
    </div>
  );
}