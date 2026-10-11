import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { UserMenu } from './UserMenu';

export function AdminLayout() {
  return (
    <>
      <div className="topbar">
        <h1 className="logo">PetroViz</h1>
        <span className="admin-badge">Админка</span>
        <UserMenu />
      </div>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `admin-nav-item ${isActive ? 'active' : ''}`
            }
          >
            👥 Пользователи
          </NavLink>
          <NavLink
            to="/admin/wells"
            className={({ isActive }) =>
              `admin-nav-item ${isActive ? 'active' : ''}`
            }
          >
            🗂️ Скважины
          </NavLink>
          <NavLink to="/" className="admin-nav-item">
            ← На главную
          </NavLink>
        </aside>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}