// src/tabs/meta/MetaBreakdowns.tsx
import { useState } from "react";
import { DataTable } from "../../components/DataTable";
import { META_BREAKDOWN_COLS } from "./columns";
import { fmtCurrency, fmtRoas } from "../../lib/format";
import type { MetaWindow, MetaBreakdownRow, MetaBreakdowns as MetaBreakdownsData } from "../../lib/data";

// "Spend by {dimension}" panel — top 10 segments with share % + ROAS + brand bar
function SpendBySegmentPanel({ rows, dimLabel, hideRoas }: { rows: MetaBreakdownRow[]; dimLabel: string; hideRoas: boolean }) {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0)).slice(0, 10);
  const total = rows.reduce((s, r) => s + Number(r.spend ?? 0), 0) || 1;
  const max = Number(sorted[0]?.spend ?? 0) || 1;

  return (
    <div className="dash-card p-5">
      <h4
        className="text-sm font-bold mb-3"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        Spend by {dimLabel}
      </h4>
      <div className="space-y-3">
        {sorted.map((r, i) => {
          const spend = Number(r.spend ?? 0);
          const share = (spend / total) * 100;
          const roasVal = Number(r.roas ?? 0);
          return (
            <div key={String(r.segment ?? i)} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium truncate" style={{ color: "var(--gaf-text-primary)" }}>
                  {String(r.segment ?? "Unknown")}
                </span>
                <span className="flex items-center gap-3 tabular-nums shrink-0" style={{ color: "var(--gaf-text-secondary)" }}>
                  {!hideRoas && roasVal > 0 && <span>{fmtRoas(roasVal)}</span>}
                  <span style={{ color: "var(--gaf-text-muted)" }}>({share.toFixed(0)}%)</span>
                  <span className="font-semibold" style={{ color: "var(--gaf-text-primary)" }}>{fmtCurrency(spend)}</span>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(spend / max) * 100}%`,
                    background: "var(--gaf-primary)",
                    opacity: 1 - i * 0.03,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const REGION_HIDDEN = new Set(["purchases", "purchaseValue", "roas", "cpa", "costPerAtc", "landingPageViews", "addToCart"]);

const REGION_BREAKDOWN_COLS = META_BREAKDOWN_COLS.map(col =>
  REGION_HIDDEN.has(col.key)
    ? { ...col, format: (v: unknown) => (v === null || v === undefined ? "n/a" : (col.format ? col.format(v) : String(v ?? ""))) }
    : col
);

interface Props {
  metaWin: MetaWindow;
}

type Row = Record<string, unknown>;

type Dim = keyof MetaBreakdownsData;

const DIMS: { key: Dim; label: string }[] = [
  { key: "platform",  label: "Platform" },
  { key: "placement", label: "Placement" },
  { key: "age",       label: "Age" },
  { key: "gender",    label: "Gender" },
  { key: "region",    label: "Region" },
];

// Region shows a privacy note (Meta withholds conversions at region level).
const REGION_NOTE =
  "Meta withholds conversion data at region level (privacy threshold), so purchases, revenue and ROAS show as n/a. Spend, impressions and clicks are accurate.";

export function MetaBreakdowns({ metaWin }: Props) {
  const breakdowns = metaWin.breakdowns ?? {};
  const [active, setActive] = useState<Dim>("platform");

  const rows = (breakdowns[active] ?? []) as MetaBreakdownRow[] as Row[];

  // For region breakdown, Meta withholds conversion data — display "n/a" for affected fields.
  const REGION_HIDDEN_FIELDS = ["purchases", "purchaseValue", "roas", "cpa", "costPerAtc", "landingPageViews", "addToCart"];
  const displayRows: Row[] = active === "region"
    ? rows.map(row => {
        const masked: Row = { ...row };
        REGION_HIDDEN_FIELDS.forEach(f => { masked[f] = null; });
        return masked;
      })
    : rows;

  return (
    <div className="space-y-4 fade-in">
      <h3
        className="text-lg font-bold"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        Breakdowns
      </h3>

      {/* Dimension sub-tab pills */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)" }}
        role="tablist"
        aria-label="Breakdown dimension"
      >
        {DIMS.map((d) => {
          const isActive = active === d.key;
          const count = (breakdowns[d.key] ?? []).length;
          return (
            <button
              key={d.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(d.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: isActive ? "var(--gaf-primary)" : "transparent",
                color: isActive ? "#fff" : "var(--gaf-text-secondary)",
              }}
            >
              {d.label}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {active === "region" && rows.length > 0 && (
        <p className="text-[11px]" style={{ color: "var(--gaf-text-muted)" }}>
          {REGION_NOTE}
        </p>
      )}

      <SpendBySegmentPanel
        rows={rows as MetaBreakdownRow[]}
        dimLabel={DIMS.find(d => d.key === active)?.label ?? ""}
        hideRoas={active === "region"}
      />

      <DataTable<Row> columns={active === "region" ? REGION_BREAKDOWN_COLS : META_BREAKDOWN_COLS} rows={displayRows} sortable />
    </div>
  );
}
