import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '../api/admin';

export function AdminWellsPage() {
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());

  const [shareModal, setShareModal] = useState(null); // { wells: [...] }  (одиночная или bulk)
  const [accessList, setAccessList] = useState([]);

  useEffect(() => {
    loadWells();
  }, []);

  const loadWells = async () => {
    setLoading(true);
    try {
      const data = await adminApi.listAllWells({ limit: 500 });
      setWells(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Фильтрация по поиску (по имени/владельцу)
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return wells;
    return wells.filter(
      (w) =>
        w.filename.toLowerCase().includes(s) ||
        (w.well_name || '').toLowerCase().includes(s) ||
        w.owner_username.toLowerCase().includes(s)
    );
  }, [wells, search]);

  // --- Выделение ---
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((w) => selected.has(w.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const newSet = new Set(selected);
      filtered.forEach((w) => newSet.delete(w.id));
      setSelected(newSet);
    } else {
      const newSet = new Set(selected);
      filtered.forEach((w) => newSet.add(w.id));
      setSelected(newSet);
    }
  };

  const toggleOne = (wellId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(wellId)) next.delete(wellId);
      else next.add(wellId);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // --- Модалки ---
  const openSingleShare = async (well) => {
    setShareModal({ wells: [well] });
    try {
      const data = await adminApi.listWellAccess(well.id);
      setAccessList(data.items);
    } catch (err) {
      alert('Не удалось загрузить доступы: ' + err.message);
    }
  };

  const openBulkShare = () => {
    const wellsToShare = wells.filter((w) => selected.has(w.id));
    if (wellsToShare.length === 0) return;
    setShareModal({ wells: wellsToShare });
    setAccessList([]); // для bulk — список текущих доступов не нужен
  };

  const closeModal = () => {
    setShareModal(null);
    setAccessList([]);
  };

  return (
    <div>
      <h2>Все скважины ({filtered.length}{search && ` из ${wells.length}`})</h2>

      {error && <div className="error-banner">Ошибка: {error}</div>}

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Поиск по файлу, скважине, владельцу…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={loadWells} disabled={loading}>
          {loading ? '…' : 'Обновить'}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-actions">
          <strong>Выбрано: {selected.size}</strong>
          <button className="btn-primary" onClick={openBulkShare}>
            🔐 Расшарить выбранные
          </button>
          <button className="btn-secondary" onClick={clearSelection}>
            Отмена
          </button>
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '30px' }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  title="Выбрать всё"
                />
              </th>
              <th>Файл</th>
              <th>Скважина</th>
              <th>Владелец</th>
              <th>Глубины</th>
              <th>Загружено</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const isSelected = selected.has(w.id);
              return (
                <tr
                  key={w.id}
                  className={isSelected ? 'selected-row' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(w.id)}
                    />
                  </td>
                  <td title={w.filename}>
                    {w.filename.length > 25
                      ? w.filename.slice(0, 23) + '…'
                      : w.filename}
                  </td>
                  <td>{w.well_name || '—'}</td>
                  <td><strong>{w.owner_username}</strong></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {w.start_depth.toFixed(0)} — {w.stop_depth.toFixed(0)} м
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(w.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      onClick={() => openSingleShare(w)}
                    >
                      Расшарить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && !loading && (
          <p style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
            {search ? 'Ничего не найдено' : 'Скважин пока нет'}
          </p>
        )}
      </div>

      {shareModal && (
        <ShareModal
          wells={shareModal.wells}
          accessList={accessList}
          onClose={closeModal}
          onChanged={() => {
            // Обновить текущие доступы для одиночного режима
            if (shareModal.wells.length === 1) {
              adminApi.listWellAccess(shareModal.wells[0].id).then((d) => {
                setAccessList(d.items);
              });
            }
          }}
          onSuccess={() => {
            // После успешного bulk — сбросить выделение и закрыть
            clearSelection();
            closeModal();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Модалка: одиночная (wells.length===1) или массовая
// ============================================================
function ShareModal({ wells, accessList, onClose, onChanged, onSuccess }) {
  const isBulk = wells.length > 1;
  const singleWell = wells[0];

  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [permission, setPermission] = useState('read');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { granted, skipped, failed }

  useEffect(() => {
    adminApi.listUsers({ limit: 500 })
      .then((d) => setAllUsers(d.items))
      .catch((err) => {
        console.error('Failed to load users:', err);
        alert('Не удалось загрузить список пользователей: ' +
              (err.response?.data?.detail || err.message));
      });
  }, []);

  const handleShare = async () => {
    if (!selectedUser) return;
    setBusy(true);
    try {
      if (isBulk) {
        const res = await adminApi.bulkShareWells(
          wells.map((w) => w.id),
          selectedUser,
          permission
        );
        setResult(res);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        await adminApi.shareWell(singleWell.id, selectedUser, permission);
        onChanged?.();
        setSelectedUser('');
      }
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Отозвать доступ?')) return;
    try {
      await adminApi.revokeWellAccess(singleWell.id, userId);
      onChanged?.();
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  // Для одиночного режима: пользователи без доступа, не владелец
  const alreadyHas = new Set(accessList.map((a) => a.user_id));
  const availableForSingle = allUsers.filter(
    (u) => !alreadyHas.has(u.id) && u.id !== singleWell.owner_id
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {isBulk ? (
          <>
            <h3>Массовая выдача доступов</h3>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Будет выдан доступ к <strong>{wells.length}</strong> скважинам
            </p>
          </>
        ) : (
          <>
            <h3>Доступы к «{singleWell.well_name || singleWell.filename}»</h3>
            <p style={{ color: '#666', fontSize: '13px' }}>
              Владелец: <strong>{singleWell.owner_username}</strong>
            </p>

            <h4>Кому уже открыт доступ:</h4>
            {accessList.length === 0 ? (
              <p style={{ color: '#999' }}>Пока никому.</p>
            ) : (
              <ul className="access-list">
                {accessList.map((a) => (
                  <li key={a.user_id}>
                    <span>
                      <strong>{a.username}</strong> ({a.email}) — {a.permission}
                    </span>
                    <button
                      className="btn-danger btn-small"
                      onClick={() => handleRevoke(a.user_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h4>{isBulk ? 'Кому выдать доступ:' : 'Добавить доступ:'}</h4>

        {result ? (
          <div className="bulk-result">
            <p>✅ Выдано: <strong>{result.granted.length}</strong></p>
            {result.skipped.length > 0 && (
              <p>⏭️ Пропущено: <strong>{result.skipped.length}</strong> (владелец)</p>
            )}
            {result.failed.length > 0 && (
              <p>❌ Ошибок: <strong>{result.failed.length}</strong></p>
            )}
            <p style={{ color: '#666', fontSize: '12px' }}>Закрываем…</p>
          </div>
        ) : (
          <div className="share-form">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">— выберите пользователя —</option>
              {(isBulk ? allUsers : availableForSingle).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="owner">owner</option>
            </select>
            <button onClick={handleShare} disabled={!selectedUser || busy}>
              {busy ? '…' : isBulk ? `Выдать (${wells.length})` : 'Выдать'}
            </button>
          </div>
        )}

        <div style={{ textAlign: 'right', marginTop: '16px' }}>
          <button className="btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}