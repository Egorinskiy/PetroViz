import React, { useState, useMemo } from 'react';
import { EyeIcon, EyeOffIcon, TrashIcon } from './Icons';
import { ConfirmDialog } from './ConfirmDialog';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hh}:${mm}`;
}

export function AllComputationsModal({
  items,
  savedTracks,
  onShow,
  onHide,
  onRemove,
  onClose,
  canDelete = () => true,
}) {
const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const isOnTrack = (id) => savedTracks.some((t) => t.id === id);

  const handleRequestDelete = (item) => {
    setDeleteTarget({
      id: item.id,
      name: item.output_mnemonic,
      onTrack: isOnTrack(item.id),
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onRemove(deleteTarget.id);
      if (deleteTarget.onTrack && onHide) {
        onHide(deleteTarget.id);
      }
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.output_mnemonic.toLowerCase().includes(s) ||
        it.method.toLowerCase().includes(s)
    );
  }, [items, search]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 560, maxWidth: 720, maxHeight: '85vh' }}
      >
        <div className="modal__header">
          Все расчёты ({items.length})
        </div>

        <div className="modal__body" style={{ paddingTop: 12 }}>
          <input
            className="input"
            type="text"
            placeholder="Поиск по имени или методу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />

          {filtered.length === 0 && (
            <div className="text-sm text-muted" style={{ padding: 24, textAlign: 'center' }}>
              {search ? 'Ничего не найдено' : 'Пока ничего не сохранено.'}
            </div>
          )}

          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {filtered.map((item) => {
              const onTrack = isOnTrack(item.id);
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                    fontSize: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
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
                      {item.method} · {formatDate(item.created_at)}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost btn--sm"
                    title={onTrack ? 'Скрыть с трека' : 'Показать на треке'}
                    onClick={() =>
                      onTrack ? onHide(item.id) : onShow(item.id)
                    }
                    style={{ padding: '4px 6px' }}
                  >
                    {onTrack ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                  </button>
                  <span
                    title={
                      canDelete(item) ? 'Удалить' : 'Нет прав на удаление'
                    }
                    style={{ display: 'inline-block' }}
                  >
                    <button
                      className="btn btn--ghost btn--sm"
                      disabled={!canDelete(item)}
                      onClick={() => handleRequestDelete(item)}
                      style={{
                        padding: '4px 6px',
                        cursor: !canDelete(item) ? 'not-allowed' : undefined,
                      }}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Удалить расчёт?"
          message={
            <div>
              <p style={{ margin: 0 }}>
                Удалить расчёт <strong>«{deleteTarget.name}»</strong>?
              </p>
              <p className="text-xs text-muted" style={{ margin: '8px 0 0' }}>
                Действие необратимо.
              </p>
            </div>
          }
          confirmLabel="Удалить"
          cancelLabel="Отмена"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}