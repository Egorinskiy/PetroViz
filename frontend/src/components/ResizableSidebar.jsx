import React, { useState, useEffect, useRef } from 'react';

/**
 * Боковая панель с регулируемой шириной и сворачиванием.
 *
 * Props:
 *   side        — 'left' | 'right'
 *   min / max   — границы ширины в px
 *   defaultWidth — начальная ширина
 *   storageKey  — префикс для localStorage (уникален для каждой панели)
 *   title       — для tooltip кнопки развернуть
 *   icon        — эмодзи-иконка для свёрнутого вида
 *   children    — содержимое панели
 */
export function ResizableSidebar({
  side = 'left',
  min = 180,
  max = 500,
  defaultWidth = 260,
  storageKey,
  title = 'Панель',
  icon = '≡',
  children,
}) {
  // --- Ширина с сохранением в localStorage ---
  const [width, setWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(`${storageKey}.width`), 10);
    if (isNaN(saved)) return defaultWidth;
    return Math.min(Math.max(saved, min), max);
  });

  // --- Свёрнутость ---
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(`${storageKey}.collapsed`) === '1';
  });

  // --- Drag ---
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(`${storageKey}.width`, String(width));
  }, [width, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}.collapsed`, collapsed ? '1' : '0');
  }, [collapsed, storageKey]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      const dx = e.clientX - startXRef.current;
      let newWidth =
        side === 'left'
          ? startWidthRef.current + dx
          : startWidthRef.current - dx;
      newWidth = Math.min(Math.max(newWidth, min), max);
      setWidth(newWidth);
    };
    const onUp = () => setDragging(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, side, min, max]);

  const onStartDrag = (e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    setDragging(true);
  };

  // --- Свёрнутый вид: узкая полоска с иконкой ---
  if (collapsed) {
    return (
      <div
        className={`resizable-sidebar resizable-sidebar--collapsed resizable-sidebar--${side}`}
        style={{ flexBasis: 36, width: 36 }}
      >
        <button
          className="resizable-sidebar__toggle"
          onClick={() => setCollapsed(false)}
          title={`Развернуть: ${title}`}
        >
          <span className="resizable-sidebar__icon">{icon}</span>
          <span className="resizable-sidebar__arrow-big">
            {side === 'left' ? '▶' : '◀'}
          </span>
        </button>
      </div>
    );
  }

  // --- Развёрнутый вид ---
  return (
    <div
      className={`resizable-sidebar resizable-sidebar--${side}${
        dragging ? ' resizable-sidebar--dragging' : ''
      }`}
      style={{ flexBasis: width, width }}
    >
      <div className="resizable-sidebar__content">{children}</div>

      {/* Drag-разделитель */}
      <div
        className={`resizable-sidebar__handle resizable-sidebar__handle--${side}${
          dragging ? ' resizable-sidebar__handle--dragging' : ''
        }`}
        onMouseDown={onStartDrag}
        title="Потяните для изменения ширины"
      />

      {/* Кнопка свернуть */}
      <button
        className="resizable-sidebar__toggle--inside"
        onClick={() => setCollapsed(true)}
        title="Свернуть"
        aria-label="Свернуть панель"
      >
        <span className="resizable-sidebar__arrow-big">
          {side === 'left' ? '◀' : '▶'}
        </span>
      </button>
    </div>
  );
}