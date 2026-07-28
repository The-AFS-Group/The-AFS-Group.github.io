// src/tabs/meta/MetaAdSets.tsx
import { useState, useMemo } from "react";
import { DataTable } from "../../components/DataTable";
import { META_ADSET_COLS } from "./columns";
import { MetricFilter, applyMetricFilter } from "./MetricFilter";
import type { MetricFilterState } from "./MetricFilter";
import type { MetaWindow, MetaEntityRow } from "../../lib/data";

type Row = Record<string, unknown>;

interface Props {
  metaWin: MetaWindow;
}

const ADSET_FILTER_METRICS = [
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

export function MetaAdSets({ metaWin }: Props) {
  const [filters, setFilters] = useState<MetricFilterState[]>([]);
  const [campaignFilter, setCampaignFilter] = useState<string>("");

  const adsets = (metaWin.adsets ?? []) as MetaEntityRow[] as Row[];

  const campaignNames = useMemo(
    () => Array.from(new Set(adsets.map(a => String(a.campaign ?? "")).filter(Boolean))).sort(),
    [adsets]
  );

  const filtered = useMemo(() => {
    const byCampaign = campaignFilter
      ? adsets.filter(a => String(a.campaign ?? "") === campaignFilter)
      : adsets;
    return applyMetricFilter(byCampaign, filters);
  }, [adsets, campaignFilter, filters]);

  const defaultSorted = useMemo(
    () => [...filtered].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0)),
    [filtered]
  );

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Ad Set Performance
        </h3>
        {campaignNames.length > 0 && (
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            className="text-xs rounded border px-2 py-1 max-w-[280px]"
            style={{
              borderColor: "var(--gaf-input-border)",
              color: "var(--gaf-text-primary)",
              background: "var(--gaf-card-bg)",
            }}
            aria-label="Filter by campaign"
          >
            <option value="">All Campaigns</option>
            {campaignNames.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Metric filter */}
      <div className="dash-card p-3 sm:p-4">
        <MetricFilter
          filters={filters}
          onChange={setFilters}
          metrics={ADSET_FILTER_METRICS}
        />
      </div>

      {filters.length > 0 && filtered.length !== adsets.length && (
        <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          Showing {filtered.length} of {adsets.length} ad sets
        </p>
      )}

      <DataTable<Row> columns={META_ADSET_COLS} rows={defaultSorted} sortable />
    </div>
  );
}
