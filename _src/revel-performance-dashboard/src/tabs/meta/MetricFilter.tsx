// src/tabs/meta/MetricFilter.tsx
import { useState } from "react";

export interface MetricFilterState {
  metric: string;
  min: string;
  max: string;
}

interface MetricDef {
  key: string;
  label: string;
}

interface Props {
  filters: MetricFilterState[];
  onChange: (f: MetricFilterState[]) => void;
  metrics: MetricDef[];
}

/** Apply numeric min/max filters to rows. Rows missing the field pass through. */
export function applyMetricFilter(
  rows: Record<string, unknown>[],
  filters: MetricFilterState[]
): Record<string, unknown>[] {
  const active = filters.filter(f => f.metric);
  if (!active.length) return rows;
  return rows.filter(row =>
    active.every(f => {
      const val = Number(row[f.metric] ?? 0);
      if (f.min !== "" && val < Number(f.min)) return false;
      if (f.max !== "" && val > Number(f.max)) return false;
      return true;
    })
  );
}

export function MetricFilter({ filters, onChange, metrics }: Props) {
  function update(idx: number, patch: Partial<MetricFilterState>) {
    const next = filters.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  }
  function remove(idx: number) {
    onChange(filters.filter((_, i) => i !== idx));
  }
  function add() {
    if (filters.length >= 4) return;
    onChange([...filters, { metric: "", min: "", max: "" }]);
  }

  const canAdd = filters.length < 4 && filters.some(f => f.metric);

  return (
    <div className="space-y-2">
      {filters.map((f, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold w-12 shrink-0"
            style={{ color: "var(--gaf-text-muted)" }}
          >
            {i === 0 ? "Filter" : "AND"}
          </span>
          <select
            value={f.metric}
            onChange={e => update(i, { metric: e.target.value })}
            className="text-xs rounded border px-2 py-1"
            style={{
              borderColor: "var(--gaf-card-border)",
              color: "var(--gaf-text-primary)",
              background: "var(--gaf-card-bg)",
            }}
          >
            <option value="">Select metric...</option>
            {metrics.map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min"
            value={f.min}
            onChange={e => update(i, { min: e.target.value })}
            className="text-xs rounded border px-2 py-1 w-20"
            style={{
              borderColor: "var(--gaf-card-border)",
              color: "var(--gaf-text-primary)",
              background: "var(--gaf-card-bg)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>to</span>
          <input
            type="number"
            placeholder="Max"
            value={f.max}
            onChange={e => update(i, { max: e.target.value })}
            className="text-xs rounded border px-2 py-1 w-20"
            style={{
              borderColor: "var(--gaf-card-border)",
              color: "var(--gaf-text-primary)",
              background: "var(--gaf-card-bg)",
            }}
          />
          <button
            onClick={() => remove(i)}
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ color: "var(--gaf-delta-neg)", background: "transparent" }}
            aria-label="Remove filter"
          >
            ✕
          </button>
        </div>
      ))}
      {filters.length === 0 && (
        <button
          onClick={add}
          className="text-xs underline"
          style={{ color: "var(--gaf-primary)" }}
        >
          + Add filter
        </button>
      )}
      {canAdd && (
        <button
          onClick={add}
          className="text-xs underline"
          style={{ color: "var(--gaf-primary)" }}
        >
          + Add filter
        </button>
      )}
    </div>
  );
}
