import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const initials = (user.full_name || user.username || '?')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="user-avatar">{initials}</span>
        <span className="user-name">{user.username}</span>
        <span className="user-caret">▾</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-info">
            <div className="user-info-name">{user.full_name || user.username}</div>
            <div className="user-info-email text-xs text-muted">{user.email}</div>
            <div className="user-info-role">
              <span className="badge badge--info">{user.role}</span>
            </div>
          </div>

          {isAdmin && (
            <Link
              to="/admin/users"
              className="user-menu-item"
              onClick={() => setOpen(false)}
            >
              ⚙️ Админка
            </Link>
          )}

          <button
            className="user-menu-item user-menu-logout"
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}