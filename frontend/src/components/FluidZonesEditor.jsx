import React from 'react';
import { FLUID_PRESETS } from '../hooks/usePorosityExpress';

/**
 * Редактор зон флюидов.
 *
 * zones = [
 *   { id, from, to, fluid: 'water' | 'oil' | 'gas' | 'custom', rho_fluid }
 * ]
 *
 * onChange(zones) — вызывается при любом изменении.
 */
export function FluidZonesEditor({ zones, onChange, minDepth, maxDepth }) {
  const handleAdd = () => {
    const step = 50;
    // Новая зона начинается там, где закончилась последняя
    const lastTo = zones.length > 0
      ? Math.max(...zones.map((z) => z.to))
      : (minDepth ?? 0);
    const defaultFrom = lastTo;
    const defaultTo = Math.min(lastTo + step, maxDepth ?? lastTo + step);
    const newZone = {
      id: `zone-${Date.now()}`,
      from: Math.round(defaultFrom),
      to: Math.round(defaultTo),
      fluid: 'gas',
      rho_fluid: FLUID_PRESETS.gas.rho,
    };
    onChange([...zones, newZone]);
  };

  const handleRemove = (id) => {
    onChange(zones.filter((z) => z.id !== id));
  };

  const handleChange = (id, patch) => {
    onChange(
      zones.map((z) => {
        if (z.id !== id) return z;
        const next = { ...z, ...patch };
        // Если изменили флюид → пересчитываем rho_fluid
        if (patch.fluid && patch.fluid !== 'custom') {
          next.rho_fluid = FLUID_PRESETS[patch.fluid].rho;
        }
        return next;
      })
    );
  };

  return (
    <div style={{ marginTop: 4 }}>
      {zones.length === 0 && (
        <div
          className="text-xs text-muted"
          style={{ padding: '6px 0', textAlign: 'center' }}
        >
          Зоны не заданы — ρf одинаков по всей скважине
        </div>
      )}

      {zones.map((z) => {
        const preset = FLUID_PRESETS[z.fluid] || FLUID_PRESETS.custom;
        const color = preset.color;
        return (
          <div
            key={z.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 4,
              padding: '4px 6px',
              background: '#fafafa',
              borderLeft: `3px solid ${color}`,
              borderRadius: 3,
              fontSize: 11,
            }}
          >
            <select
              value={z.fluid}
              onChange={(e) => handleChange(z.id, { fluid: e.target.value })}
              style={{
                flex: '0 0 78px',
                fontSize: 11,
                padding: '2px 4px',
                color,
                fontWeight: 600,
                border: '1px solid #ddd',
                borderRadius: 3,
              }}
            >
              {Object.entries(FLUID_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>

            <input
              type="number"
              value={z.from}
              onChange={(e) =>
                handleChange(z.id, { from: Number(e.target.value) })
              }
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                padding: '2px 4px',
                border: '1px solid #ddd',
                borderRadius: 3,
                fontFamily: 'monospace',
              }}
              title="От, м"
            />
            <span style={{ color: '#999' }}>–</span>
            <input
              type="number"
              value={z.to}
              onChange={(e) =>
                handleChange(z.id, { to: Number(e.target.value) })
              }
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 11,
                padding: '2px 4px',
                border: '1px solid #ddd',
                borderRadius: 3,
                fontFamily: 'monospace',
              }}
              title="До, м"
            />

            {z.fluid === 'custom' && (
              <input
                type="number"
                step="0.05"
                value={z.rho_fluid}
                onChange={(e) =>
                  handleChange(z.id, { rho_fluid: Number(e.target.value) })
                }
                style={{
                  flex: '0 0 48px',
                  fontSize: 11,
                  padding: '2px 4px',
                  border: '1px solid #ddd',
                  borderRadius: 3,
                  fontFamily: 'monospace',
                }}
                title="ρf, g/cm³"
              />
            )}

            <button
              onClick={() => handleRemove(z.id)}
              className="btn btn--ghost btn--sm"
              style={{ padding: '2px 6px', fontSize: 11 }}
              title="Удалить зону"
            >
              🗑
            </button>
          </div>
        );
      })}

      <button
        onClick={handleAdd}
        className="btn btn--ghost btn--sm"
        style={{
          width: '100%',
          padding: '4px 8px',
          fontSize: 11,
          marginTop: 4,
        }}
      >
        + Добавить зону
      </button>
    </div>
  );
}