// src/tabs/meta/MetaCampaigns.tsx
import { useState, useMemo } from "react";
import { DataTable } from "../../components/DataTable";
import { META_CAMPAIGN_COLS } from "./columns";
import { MetricFilter, applyMetricFilter } from "./MetricFilter";
import type { MetricFilterState } from "./MetricFilter";
import type { MetaWindow, MetaEntityRow } from "../../lib/data";

type Row = Record<string, unknown>;

interface Props {
  metaWin: MetaWindow;
}

const CAMPAIGN_FILTER_METRICS = [
  { key: "spend",          label: "Spend" },
  { key: "impressions",    label: "Impressions" },
  { key: "reach",          label: "Reach" },
  { key: "clicks",         label: "Clicks" },
  { key: "ctr",            label: "CTR" },
  { key: "cpc",            label: "CPC" },
  { key: "cpm",            label: "CPM" },
  { key: "conversions",    label: "Conversions" },
  { key: "convValue",      label: "Revenue" },
  { key: "roas",           label: "ROAS" },
  { key: "addToCart",      label: "ATC" },
  { key: "cpa",            label: "CPA" },
];

export function MetaCampaigns({ metaWin }: Props) {
  const [filters, setFilters] = useState<MetricFilterState[]>([]);

  const campaigns = (metaWin.campaigns ?? []) as MetaEntityRow[] as Row[];

  const filtered = useMemo(
    () => applyMetricFilter(campaigns, filters),
    [campaigns, filters]
  );

  // Sort filtered by spend desc by default (DataTable handles further sorting).
  const defaultSorted = useMemo(
    () => [...filtered].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0)),
    [filtered]
  );

  return (
    <div className="space-y-4 fade-in">
      <h3
        className="text-lg font-bold"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        Campaign Performance
      </h3>

      {/* Metric filter */}
      <div className="dash-card p-3 sm:p-4">
        <MetricFilter
          filters={filters}
          onChange={setFilters}
          metrics={CAMPAIGN_FILTER_METRICS}
        />
      </div>

      {filters.length > 0 && filtered.length !== campaigns.length && (
        <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          Showing {filtered.length} of {campaigns.length} campaigns
        </p>
      )}

      <DataTable<Row> columns={META_CAMPAIGN_COLS} rows={defaultSorted} sortable />
    </div>
  );
}
