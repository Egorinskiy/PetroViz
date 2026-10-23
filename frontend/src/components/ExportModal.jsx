import React, { useState } from 'react';
import { DownloadIcon } from './Icons';

/**
 * Универсальная модалка экспорта (LAS или CSV).
 *
 * Props:
 *   format   — 'las' | 'csv'
 *   items    — список сохранённых расчётов
 *   onCancel — отмена
 *   onConfirm(computationIds, includeSourceCurves) — экспорт
 *   saving   — блокирует кнопки
 *   error    — текст ошибки
 */
export function ExportModal({
  format = 'las',
  items,
  onCancel,
  onConfirm,
  saving = false,
  error = null,
}) {
  const [selected, setSelected] = useState(
    () => new Set(items.map((i) => i.id))
  );
  const [includeSource, setIncludeSource] = useState(true);

  const isCsv = format === 'csv';
  const formatLabel = isCsv ? 'CSV' : 'LAS';
  const ext = isCsv ? '.csv' : '.las';

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const allChecked = items.length > 0 && selected.size === items.length;
  const canDownload = includeSource || selected.size > 0;

  return (
    <div className="modal-overlay" onClick={saving ? undefined : onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 460, maxWidth: 560 }}
      >
        <div className="modal__header">Экспорт в {formatLabel}</div>

        <div className="modal__body">
          <p
            className="text-sm text-muted"
            style={{ marginTop: 0, marginBottom: 12 }}
          >
            {isCsv ? (
              <>
                Экспортируется: {includeSource && <><strong>исходные кривые</strong> + </>}
                <strong>выбранные расчёты</strong> в CSV (UTF-8, разделитель
                «запятая»). Откроется в Excel, pandas, R.
              </>
            ) : (
              <>
                Экспортируется: {includeSource && <><strong>исходные кривые</strong> + </>}
                <strong>выбранные расчёты</strong>. Файл откроется в Techlog,
                Geolog, IP.
              </>
            )}
          </p>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              marginBottom: 12,
              background: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border-light)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <input
              type="checkbox"
              checked={includeSource}
              onChange={(e) => setIncludeSource(e.target.checked)}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Включать исходные кривые</div>
              <div className="text-xs text-muted">
                {includeSource
                  ? 'Все кривые из LAS + расчёты'
                  : 'Только DEPTH + выбранные расчёты'}
              </div>
            </div>
          </label>

          {items.length === 0 ? (
            <div className="text-sm text-muted" style={{ padding: '12px 0' }}>
              Нет сохранённых расчётов — экспорт только{' '}
              {includeSource ? 'исходных кривых' : 'DEPT (пустой файл)'}.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--color-border-light)',
                  marginBottom: 4,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                  />
                  Выбрать все ({items.length})
                </label>
                <span className="text-xs text-muted">
                  Выбрано: {selected.size}
                </span>
              </div>

              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {items.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 4px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {item.output_mnemonic}
                      </div>
                      <div
                        className="text-xs text-muted"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.method}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="banner banner--error" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}

          {!canDownload && (
            <div className="banner banner--warning" style={{ marginTop: 10 }}>
              Ничего не выбрано. Включите исходные кривые или отметьте
              хотя бы один расчёт.
            </div>
          )}
        </div>

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
            onClick={() => onConfirm(Array.from(selected), includeSource)}
            disabled={saving || !canDownload}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <DownloadIcon size={14} />
            <span>{saving ? 'Экспорт…' : `Скачать ${ext}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}