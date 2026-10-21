import React, { useState, useEffect } from 'react';

/**
 * Сворачиваемая секция панели расчётов.
 * Состояние (свёрнута/развёрнута) сохраняется в localStorage.
 *
 * Props:
 *   title            — заголовок секции
 *   storageKey       — уникальный ключ для localStorage (без префикса)
 *   defaultCollapsed — по умолчанию свёрнута (false)
 *   headerRight      — опциональный элемент справа в заголовке (кнопка)
 *   style            — дополнительные стили контейнера
 *   children         — содержимое
 */
export function CollapsibleSection({
  title,
  storageKey,
  defaultCollapsed = false,
  headerRight = null,
  style,
  children,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(
      `petroviz.section.${storageKey}.collapsed`
    );
    if (saved === '1') return true;
    if (saved === '0') return false;
    return defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(
      `petroviz.section.${storageKey}.collapsed`,
      collapsed ? '1' : '0'
    );
  }, [storageKey, collapsed]);

  return (
    <div className="computations-panel__section" style={style}>
      <div
        className="computations-panel__section-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.15s',
              fontSize: 9,
              color: 'var(--color-text-subtle)',
              width: 10,
            }}
          >
            ▼
          </span>
          <span>{title}</span>
        </span>
        {headerRight && (
          <span
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {headerRight}
          </span>
        )}
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}