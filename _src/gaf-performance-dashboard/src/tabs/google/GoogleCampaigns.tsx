// src/tabs/google/GoogleCampaigns.tsx
import { useState } from "react";
import { DataTable } from "../../components/DataTable";
import { fmtCpc, fmtCurrency, fmtInt, fmtPct, fmtRoas } from "../../lib/format";

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: "Search",
  SHOPPING: "Shopping",
  PERFORMANCE_MAX: "Performance Max",
  DISPLAY: "Display",
  VIDEO: "Video",
  DEMAND_GEN: "Demand Gen",
  MULTI_CHANNEL: "Demand Gen",
  UNKNOWN: "Other",
};

type Row = Record<string, unknown>;

const COLUMNS = [
  {
    key: "channel" as const,
    label: "Channel",
    align: "left" as const,
    format: (v: unknown) => CHANNEL_LABELS[String(v ?? "")] || String(v ?? "") || "Other",
  },
  { key: "name" as const, label: "Campaign", align: "left" as const, isName: true },
  { key: "spend" as const, label: "Spend", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions" as const, label: "Impr.", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks" as const, label: "Clicks", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr" as const, label: "CTR", align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "avgCpc" as const, label: "CPC", align: "right" as const, format: (v: unknown) => fmtCpc(Number(v ?? 0)) },
  { key: "cpm" as const, label: "CPM", align: "right" as const, format: (v: unknown) => fmtCpc(Number(v ?? 0)) },
  { key: "conversions" as const, label: "Conv.", align: "right" as const, format: (v: unknown) => Number(v ?? 0).toFixed(1) },
  { key: "convValue" as const, label: "Conv. Value", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas" as const, label: "ROAS", align: "right" as const, format: (v: unknown) => fmtRoas(Number(v ?? 0)) },
  { key: "cpa" as const, label: "CPA", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
] satisfies { key: keyof Row & string; label: string; align: "left" | "right"; format?: (v: unknown) => string; isName?: boolean; tooltip?: string; sub?: (row: Row) => string }[];

interface Props {
  googleWin: Record<string, any>;
}

export function GoogleCampaigns({ googleWin }: Props) {
  const campaigns = (googleWin.campaigns ?? []) as Row[];

  // Derive unique channel types from the real `channel` field
  const allChannels = Array.from(
    new Set(campaigns.map((c) => String(c.channel ?? "")).filter(Boolean))
  );

  const [channelFilter, setChannelFilter] = useState<string>("All");

  const filtered =
    channelFilter === "All"
      ? campaigns
      : campaigns.filter((c) => String(c.channel ?? "") === channelFilter);

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Campaign Performance
        </h3>
        {/* Channel filter pills */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-gray-100">
          {["All", ...allChannels].map((ch) => {
            const isActive = channelFilter === ch;
            return (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? "#fff" : "transparent",
                  color: isActive ? "#111827" : "var(--gaf-text-muted)",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}
              >
                {ch === "All" ? "All" : (CHANNEL_LABELS[ch] || ch)}
              </button>
            );
          })}
        </div>
      </div>

      <DataTable<Row> columns={COLUMNS} rows={filtered} sortable />

      <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        All figures reflect the selected window.
      </p>
    </div>
  );
}
