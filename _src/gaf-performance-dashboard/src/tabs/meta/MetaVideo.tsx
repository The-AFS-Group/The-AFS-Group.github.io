// src/tabs/meta/MetaVideo.tsx
// Video performance: large media cards (reference parity) that open a modal
// with inline playback, retention bars and Preview Ad / Ads Manager links.
import { useMemo, useState } from "react";
import { fmtCurrency, fmtInt, fmtPct } from "../../lib/format";
import { DataTable } from "../../components/DataTable";
import { MetaVideoModal } from "./MetaVideoModal";
import type { VideoModalTarget } from "./MetaVideoModal";
import { MetricFilter, applyMetricFilter } from "./MetricFilter";
import type { MetricFilterState } from "./MetricFilter";
import type { MetaWindow, MetaVideoRow } from "../../lib/data";

interface Props {
  metaWin: MetaWindow;
}

type SortVideoKey = "spend" | "thumbStopRate" | "p100Rate" | "videoPlays" | "avgWatchTime";
type ViewMode = "cards" | "table";

const SORT_OPTIONS: { key: SortVideoKey; label: string }[] = [
  { key: "spend",         label: "Spend" },
  { key: "thumbStopRate", label: "Thumb Stop %" },
  { key: "p100Rate",      label: "Completion %" },
  { key: "videoPlays",    label: "Plays" },
  { key: "avgWatchTime",  label: "Avg Watch Time" },
];

// Numeric min/max filter metrics (mirrors Campaigns/Ad Sets, mapped to video fields).
const VIDEO_FILTER_METRICS = [
  { key: "spend",          label: "Spend" },
  { key: "videoPlays",     label: "Plays" },
  { key: "thruPlays",      label: "ThruPlays" },
  { key: "thumbStopRate",  label: "Thumb Stop %" },
  { key: "p25Rate",        label: "25% Played" },
  { key: "p50Rate",        label: "50% Played" },
  { key: "p75Rate",        label: "75% Played" },
  { key: "p100Rate",       label: "Completion %" },
  { key: "avgWatchTime",   label: "Avg Watch (s)" },
  { key: "impressions",    label: "Impressions" },
  { key: "atc",            label: "ATC" },
  { key: "engagements",    label: "Engagements" },
];

// Retention colour: >=50% green, >=25% amber, else red (per spec).
function retentionColor(pct: number): string {
  if (pct >= 50) return "var(--gaf-delta-pos)";
  if (pct >= 25) return "#d97706"; // amber-600
  return "var(--gaf-delta-neg)";
}

function RetentionBar({ label, pct }: { label: string; pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = retentionColor(pct);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-16 shrink-0" style={{ color: "var(--gaf-text-muted)" }}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
        <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <span className="text-[10px] w-10 text-right tabular-nums font-semibold" style={{ color: "var(--gaf-text-primary)" }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="dash-card p-3 flex flex-col min-w-0">
      <span className="text-[9px] uppercase tracking-wider truncate" style={{ color: "var(--gaf-text-muted)" }}>
        {label}
      </span>
      <span
        className="text-lg font-bold tabular-nums truncate"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}

function PlayOverlay() {
  return (
    <span className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      <span
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="white">
          <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.7l8.2-5.2c.5-.3.5-1 0-1.3L5.7 2.1c-.5-.3-1.2 0-1.2.7Z" />
        </svg>
      </span>
    </span>
  );
}

const TABLE_COLS = [
  { key: "adName",       label: "Ad Name",        align: "left" as const },
  { key: "campaign",     label: "Campaign",        align: "left" as const },
  { key: "spend",        label: "Spend",           align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "videoPlays",   label: "Plays",           align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "thruPlays",    label: "ThruPlays",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "thumbStopRate",label: "Thumb Stop %",    align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "p25Rate",      label: "25% Played",      align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "p50Rate",      label: "50% Played",      align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "p75Rate",      label: "75% Played",      align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "p100Rate",     label: "Completion %",    align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "avgWatchTime", label: "Avg Watch (s)",   align: "right" as const, format: (v: unknown) => `${Number(v ?? 0).toFixed(1)}s` },
  { key: "impressions",  label: "Impr.",           align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "atc",          label: "ATC",             align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "engagements",  label: "Engagements",     align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
];

export function MetaVideo({ metaWin }: Props) {
  const [sortKey, setSortKey] = useState<SortVideoKey>("spend");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<VideoModalTarget | null>(null);
  const [filters, setFilters] = useState<MetricFilterState[]>([]);

  const video = (metaWin.video ?? []) as MetaVideoRow[];
  const withPlays = video.filter((v) => Number(v.videoPlays ?? 0) > 0);

  // Media + video source + preview link live on the creative rows — join by adId.
  const creativeByAd = useMemo(() => {
    const map = new Map<string, { thumbnailUrl: string; videoId: string; previewLink: string }>();
    for (const c of metaWin.creative ?? []) {
      if (!c.adId) continue;
      map.set(String(c.adId), {
        thumbnailUrl: String(c.thumbnailUrl || c.imageUrl || ""),
        videoId: String(c.videoId || ""),
        previewLink: String(c.previewLink || ""),
      });
    }
    return map;
  }, [metaWin.creative]);

  // Numeric min/max filters narrow the whole view (KPIs + listing).
  const filteredPlays = useMemo(
    () => applyMetricFilter(withPlays, filters) as MetaVideoRow[],
    [withPlays, filters]
  );

  const sorted = useMemo(() => {
    return [...filteredPlays].sort((a, b) => Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0));
  }, [filteredPlays, sortKey]);

  // Summary KPIs
  const totalSpend = filteredPlays.reduce((s, v) => s + Number(v.spend ?? 0), 0);
  const thumbStops = filteredPlays.map(v => Number(v.thumbStopRate ?? 0)).filter(x => x > 0);
  const avgThumbStop = thumbStops.length ? thumbStops.reduce((a, b) => a + b, 0) / thumbStops.length : 0;
  const completions = filteredPlays.map(v => Number(v.p100Rate ?? 0)).filter(x => x > 0);
  const avgCompletion = completions.length ? completions.reduce((a, b) => a + b, 0) / completions.length : 0;
  const watchTimes = filteredPlays.map(v => Number(v.avgWatchTime ?? 0)).filter(x => x > 0);
  const avgWatch = watchTimes.length ? watchTimes.reduce((a, b) => a + b, 0) / watchTimes.length : 0;

  if (withPlays.length === 0) {
    return (
      <div className="fade-in dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No video retention data available for this window.
      </div>
    );
  }

  const openModal = (v: MetaVideoRow) => {
    const joined = creativeByAd.get(String(v.adId ?? ""));
    setSelected({ ...v, ...joined });
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiPill label="Total Video Spend" value={fmtCurrency(totalSpend)} />
        <KpiPill label="Avg Thumb Stop %" value={fmtPct(avgThumbStop)} />
        <KpiPill label="Avg Completion %" value={fmtPct(avgCompletion)} />
        <KpiPill label="Avg Watch Time" value={`${avgWatch.toFixed(1)}s`} />
      </div>

      {/* Header + controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Video Performance
          </h3>
          <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
            {sorted.length} video ad{sorted.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sort by */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>Sort:</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortVideoKey)}
              className="text-xs rounded border px-2 py-1"
              style={{
                borderColor: "var(--gaf-card-border)",
                color: "var(--gaf-text-primary)",
                background: "var(--gaf-card-bg)",
              }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1">
            {(["cards", "table"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors capitalize"
                style={{
                  background: viewMode === v ? "var(--gaf-primary)" : "var(--gaf-primary-light)",
                  color: viewMode === v ? "#fff" : "var(--gaf-primary)",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric filter */}
      <div className="dash-card p-3 sm:p-4">
        <MetricFilter
          filters={filters}
          onChange={setFilters}
          metrics={VIDEO_FILTER_METRICS}
        />
      </div>

      {sorted.length === 0 && (
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No video ads match the current filters.
        </div>
      )}

      {/* Cards view */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((v, i) => {
            const joined = creativeByAd.get(String(v.adId ?? ""));
            const thumb = joined?.thumbnailUrl;
            return (
              <div
                key={v.adId ?? i}
                className="dash-card overflow-hidden flex flex-col min-w-0 cursor-pointer transition-shadow hover:shadow-lg"
                onClick={() => openModal(v)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") openModal(v); }}
                aria-label={`View details for ${String(v.adName ?? "video ad")}`}
              >
                {/* Media strip */}
                <div className="relative" style={{ background: "#0a0a0a" }}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="w-full object-contain"
                      style={{ maxHeight: 200, minHeight: 140 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full flex items-center justify-center text-xs" style={{ height: 140, color: "#9ca3af" }}>
                      No preview
                    </div>
                  )}
                  <PlayOverlay />
                  <span
                    className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: "var(--gaf-primary)" }}
                  >
                    {i + 1}
                  </span>
                </div>

                <div className="p-4 flex flex-col gap-3 min-w-0 flex-1">
                  <div className="min-w-0">
                    <p
                      className="text-sm font-bold leading-snug line-clamp-1"
                      style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
                      title={String(v.adName ?? "")}
                    >
                      {String(v.adName ?? "Untitled ad")}
                    </p>
                    {Boolean(v.campaign) && (
                      <p className="text-[11px] truncate" style={{ color: "var(--gaf-text-muted)" }} title={String(v.campaign)}>
                        {String(v.campaign)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Spend", value: fmtCurrency(Number(v.spend ?? 0)) },
                      { label: "Plays", value: fmtInt(Number(v.videoPlays ?? 0)) },
                      { label: "Avg Watch", value: `${Number(v.avgWatchTime ?? 0).toFixed(1)}s` },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>{s.label}</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-auto">
                    <RetentionBar label="Thumb Stop" pct={Number(v.thumbStopRate ?? 0)} />
                    <RetentionBar label="25%" pct={Number(v.p25Rate ?? 0)} />
                    <RetentionBar label="50%" pct={Number(v.p50Rate ?? 0)} />
                    <RetentionBar label="75%" pct={Number(v.p75Rate ?? 0)} />
                    <RetentionBar label="Completion" pct={Number(v.p100Rate ?? 0)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <DataTable<Record<string, unknown>>
          columns={TABLE_COLS}
          rows={sorted as unknown as Record<string, unknown>[]}
          sortable
        />
      )}

      <p className="text-[11px]" style={{ color: "var(--gaf-text-muted)" }}>
        Click a card to play the video and open Preview Ad / Ads Manager links.
        Retention rates are the percentage of video plays reaching each quartile:{" "}
        <span style={{ color: "var(--gaf-delta-pos)" }}>green</span> &ge;50%,{" "}
        <span style={{ color: "#d97706" }}>amber</span> &ge;25%,{" "}
        <span style={{ color: "var(--gaf-delta-neg)" }}>red</span> &lt;25%.
      </p>

      {/* Modal */}
      <MetaVideoModal video={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
