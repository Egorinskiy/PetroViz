import React, { useState, useEffect } from 'react';
import { computationsApi } from '../api/computations';

/**
 * Выбор сохранённого расчёта как источника для другой кривой (Vsh / PHI).
 *
 * Props:
 *   role        — "phi" | "vsh"
 *   requirement — { label, category }
 *   savedItems  — список сохранённых расчётов скважины
 *   methods     — список методов (для маппинга method → category)
 *   value       — UUID выбранного расчёта (или "")
 *   onChange    — (uuid) => void
 */
export function SourceSelector({
  role,
  requirement,
  savedItems,
  methods,
  value,
  onChange,
}) {
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Фильтр сохранённых по категории метода
  const methodByKey = React.useMemo(() => {
    const map = {};
    (methods || []).forEach((m) => {
      map[m.key] = m;
    });
    return map;
  }, [methods]);

  const eligible = React.useMemo(() => {
    return (savedItems || []).filter((item) => {
      const method = methodByKey[item.method];
      return method && method.category === requirement.category;
    });
  }, [savedItems, methodByKey, requirement.category]);

  // Загрузка превью выбранного расчёта
  useEffect(() => {
    setPreview(null);
    if (!value) return;

    let cancelled = false;
    setPreviewLoading(true);
    computationsApi
      .getData(value)
      .then((data) => {
        if (cancelled) return;
        const values = (data.values || []).filter(
          (v) => v != null && isFinite(v)
        );
        if (values.length === 0) {
          setPreview({ n: 0 });
          return;
        }
        const sum = values.reduce((s, v) => s + v, 0);
        setPreview({
          n: values.length,
          mean: sum / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPreview(null);
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  const hasEligible = eligible.length > 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          fontSize: 11,
          color: '#666',
          display: 'block',
          marginBottom: 3,
        }}
      >
        {requirement.label}
      </label>

      {!hasEligible ? (
        <div
          className="banner banner--warning"
          style={{ padding: '6px 8px', fontSize: 11 }}
        >
          ⚠️ Нет сохранённых расчётов категории «{requirement.category}».
          <br />
          Посчитайте в «Одиночном» и нажмите 💾.
        </div>
      ) : (
        <select
          className="select"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', fontSize: 12 }}
        >
          <option value="">— выберите расчёт —</option>
          {eligible.map((item) => (
            <option key={item.id} value={item.id}>
              {item.output_mnemonic} · {item.method} · {item.num_samples} т.
            </option>
          ))}
        </select>
      )}

      {value && previewLoading && (
        <div className="text-xs text-muted" style={{ marginTop: 4 }}>
          Загрузка статистики…
        </div>
      )}

      {value && preview && !previewLoading && (
        <div
          className="text-xs text-muted"
          style={{
            marginTop: 4,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span>N={preview.n}</span>
          {preview.mean !== undefined && (
            <>
              <span>mean={preview.mean.toFixed(3)}</span>
              <span>min={preview.min.toFixed(3)}</span>
              <span>max={preview.max.toFixed(3)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}