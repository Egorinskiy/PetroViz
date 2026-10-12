import React, { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../api/admin';
import { useAuth } from '../hooks/useAuth';

const ROLES = ['viewer', 'geophysicist', 'admin'];

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listUsers({
        search: search || undefined,
        limit: 100,
      });
      setUsers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const updated = await adminApi.updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      flash(`Роль обновлена: ${updated.username} → ${updated.role}`);
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const updated = await adminApi.updateUser(user.id, {
        is_active: !user.is_active,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      flash(`${updated.username} ${updated.is_active ? 'активирован' : 'деактивирован'}`);
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Удалить пользователя "${user.username}"? Действие необратимо.`)) {
      return;
    }
    try {
      await adminApi.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setTotal((t) => t - 1);
      flash(`Пользователь ${user.username} удалён`);
    } catch (err) {
      alert(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div>
      <h2>Пользователи ({total})</h2>

      <div className="admin-toolbar">
        <input
          className="input"
          type="text"
          placeholder="Поиск по username, email, full_name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className="btn btn--primary"
          onClick={load}
          disabled={loading}
        >
          {loading ? '…' : 'Обновить'}
        </button>
      </div>

      {error && <div className="banner banner--error">Ошибка: {error}</div>}
      {successMsg && <div className="banner banner--success">{successMsg}</div>}

      <div className="table-wrapper">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Полное имя</th>
              <th>Роль</th>
              <th>Активен</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <tr
                  key={u.id}
                  className={!u.is_active ? 'inactive-row' : ''}
                >
                  <td>
                    <strong>{u.username}</strong>
                    {isSelf && <span className="badge badge--info badge-you">вы</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>{u.full_name || '—'}</td>
                  <td>
                    <select
                      className="select"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={isSelf}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      onChange={() => handleToggleActive(u)}
                      disabled={isSelf}
                    />
                  </td>
                  <td className="text-sm text-muted">
                    {u.last_login
                      ? new Date(u.last_login).toLocaleString()
                      : 'никогда'}
                  </td>
                  <td>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => handleDelete(u)}
                      disabled={isSelf}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {users.length === 0 && !loading && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>
            Нет пользователей
          </p>
        )}
      </div>
    </div>
  );
}