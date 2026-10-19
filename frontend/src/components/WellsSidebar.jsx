import React, { useState, useMemo } from 'react';
import { FolderIcon, GlobeIcon } from './Icons';

export function WellsSidebar({
  wells,
  loading,
  activeWellId,
  onSelect,
  onDelete,
  reload,
}) {
  const [search, setSearch] = useState('');
  const [showShared, setShowShared] = useState(true);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return wells.filter((w) => {
      if (!showShared && !w.is_owner) return false;
      if (!s) return true;
      return (
        w.filename.toLowerCase().includes(s) ||
        (w.well_name || '').toLowerCase().includes(s)
      );
    });
  }, [wells, search, showShared]);

  const myCount = wells.filter((w) => w.is_owner).length;
  const sharedCount = wells.length - myCount;

  const handleDelete = async (e, well) => {
    e.stopPropagation();
    if (!window.confirm(`Удалить скважину «${well.well_name || well.filename}»?`)) {
      return;
    }
    await onDelete(well);
  };

  return (
    <aside className="wells-sidebar">
      <div className="wells-sidebar-header">
        <div className="wells-sidebar-title">
          Мои скважины ({wells.length})
          {sharedCount > 0 && (
            <span className="badge badge--shared shared-count">
              +{sharedCount} shared
            </span>
          )}
        </div>
        <button
          className="btn btn--ghost btn--sm wells-sidebar-refresh"
          onClick={reload}
          disabled={loading}
          title="Обновить список"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      <input
        type="text"
        className="input wells-sidebar-search"
        placeholder="Поиск…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {sharedCount > 0 && (
        <label className="wells-sidebar-filter">
          <input
            type="checkbox"
            checked={showShared}
            onChange={(e) => setShowShared(e.target.checked)}
          />
          Показывать shared
        </label>
      )}

      <div className="wells-sidebar-list">
        {filtered.length === 0 && !loading && (
          <div className="wells-sidebar-empty">
            {wells.length === 0
              ? 'Загрузите первый LAS-файл'
              : 'Ничего не найдено'}
          </div>
        )}

        {filtered.map((w) => {
          const isActive = w.well_id === activeWellId;
          return (
            <div
              key={w.well_id}
              className={`well-item ${isActive ? 'active' : ''} ${
                !w.is_owner ? 'shared' : ''
              }`}
              onClick={() => onSelect(w)}
            >
              <div className="well-item-icon">
                {w.is_owner ? <FolderIcon size={14} /> : <GlobeIcon size={14} />}
              </div>
              <div className="well-item-content">
                <div className="well-item-name" title={w.well_name || w.filename}>
                  {w.well_name || w.filename}
                </div>
                <div className="well-item-meta font-mono">
                  {w.start_depth.toFixed(0)}—{w.stop_depth.toFixed(0)} м
                  {w.is_owner ? '' : ' · shared'}
                </div>
              </div>
              {w.is_owner && (
                <button
                  className="well-item-delete"
                  onClick={(e) => handleDelete(e, w)}
                  title="Удалить"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}