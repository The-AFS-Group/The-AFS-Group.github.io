// src/tabs/meta/MetaCreative.tsx
// Creative grid to reference standard: dark media strip, play overlay,
// type + objective pills, highlighted rank metric, 12-stat grid,
// top-3 brand borders and green/red performance borders vs the visible mean.
import { useState, useMemo } from "react";
import { fmtCurrency, fmtCpc, fmtCompact, fmtPct, fmtInt, fmtRoas, fmtCurrencyCompact } from "../../lib/format";
import { DataTable } from "../../components/DataTable";
import { MetaCreativeModal } from "./MetaCreativeModal";
import { MetricFilter, applyMetricFilter } from "./MetricFilter";
import type { MetricFilterState } from "./MetricFilter";
import { OBJECTIVE_LABELS, OBJECTIVE_BADGE } from "./columns";
import type { MetaWindow, MetaCreativeRow } from "../../lib/data";

interface Props {
  metaWin: MetaWindow;
}

type TypeFilter = "All" | "Video" | "Image";
type ViewMode = "cards" | "table";

// Rank-by options — lower-is-better metrics sort ascending (reference parity).
const SORT_OPTIONS: { key: string; label: string; lowerBetter?: boolean; fmt: (n: number) => string }[] = [
  { key: "spend",           label: "Spend",                       fmt: fmtCurrency },
  { key: "roas",            label: "ROAS",                        fmt: fmtRoas },
  { key: "purchaseValue",   label: "Revenue",                     fmt: fmtCurrencyCompact },
  { key: "purchases",       label: "Purchases",                   fmt: fmtInt },
  { key: "cpa",             label: "CPA (low is better)",         lowerBetter: true, fmt: fmtCpc },
  { key: "addToCart",       label: "Add to Cart",                 fmt: fmtInt },
  { key: "atcRate",         label: "ATC Rate",                    fmt: fmtPct },
  { key: "engagements",     label: "Engagements",                 fmt: fmtCompact },
  { key: "engagementRate",  label: "Engagement Rate",             fmt: fmtPct },
  { key: "ctr",             label: "CTR",                         fmt: fmtPct },
  { key: "cpc",             label: "CPC (low is better)",         lowerBetter: true, fmt: fmtCpc },
  { key: "cpm",             label: "CPM (low is better)",         lowerBetter: true, fmt: fmtCpc },
  { key: "impressions",     label: "Impressions",                 fmt: fmtCompact },
  { key: "reach",           label: "Reach",                       fmt: fmtCompact },
  { key: "clicks",          label: "Clicks",                      fmt: fmtCompact },
];

// Numeric min/max filter metrics (mirrors Campaigns/Ad Sets, mapped to creative fields).
const CREATIVE_FILTER_METRICS = [
  { key: "spend",          label: "Spend" },
  { key: "roas",           label: "ROAS" },
  { key: "purchaseValue",  label: "Revenue" },
  { key: "purchases",      label: "Purchases" },
  { key: "cpa",            label: "CPA" },
  { key: "addToCart",      label: "ATC" },
  { key: "atcRate",        label: "ATC Rate" },
  { key: "ctr",            label: "CTR" },
  { key: "cpc",            label: "CPC" },
  { key: "cpm",            label: "CPM" },
  { key: "impressions",    label: "Impressions" },
  { key: "reach",          label: "Reach" },
  { key: "clicks",         label: "Clicks" },
  { key: "engagements",    label: "Engagements" },
  { key: "engagementRate", label: "Eng Rate" },
];

// Small labelled stat used in the card footer grid.
function Stat({ label, value, dash }: { label: string; value: string; dash?: boolean }) {
  return (
    <div className="flex flex-col min-w-0">
      <span
        className="text-[9px] uppercase tracking-wider truncate"
        style={{ color: "var(--gaf-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-xs font-bold tabular-nums truncate"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        {dash ? "–" : value}
      </span>
    </div>
  );
}

function PlayOverlay() {
  return (
    <span
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden="true"
    >
      <span
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
          <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.7l8.2-5.2c.5-.3.5-1 0-1.3L5.7 2.1c-.5-.3-1.2 0-1.2.7Z" />
        </svg>
      </span>
    </span>
  );
}

function ObjectivePill({ objective }: { objective?: string }) {
  const label = OBJECTIVE_LABELS[String(objective ?? "")] ?? "";
  if (!label) return null;
  const style = OBJECTIVE_BADGE[label] ?? { bg: "#f3f4f6", color: "#4b5563" };
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  );
}

const TABLE_COLS = [
  { key: "adName",         label: "Ad Name",     align: "left" as const },
  { key: "campaign",       label: "Campaign",     align: "left" as const },
  { key: "_type",          label: "Type",         align: "left" as const },
  { key: "spend",          label: "Spend",        align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas",           label: "ROAS",         align: "right" as const, format: (v: unknown) => fmtRoas(Number(v ?? 0)) },
  { key: "ctr",            label: "CTR",          align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "purchases",      label: "Purchases",    align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "impressions",    label: "Impr.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "reach",          label: "Reach",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "engagements",    label: "Engagements",  align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "engagementRate", label: "Eng Rate",     align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
];

export function MetaCreative({ metaWin }: Props) {
  const [selectedCreative, setSelectedCreative] = useState<MetaCreativeRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<string>("spend");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filters, setFilters] = useState<MetricFilterState[]>([]);

  const creative = (metaWin.creative ?? []) as MetaCreativeRow[];

  const campaignNames = useMemo(
    () => Array.from(new Set(creative.map(c => String(c.campaign ?? "")).filter(Boolean))).sort(),
    [creative]
  );

  const sortOption = SORT_OPTIONS.find(o => o.key === sortKey) ?? SORT_OPTIONS[0];

  const filtered = useMemo(() => {
    let rows = [...creative];
    if (typeFilter === "Video") rows = rows.filter(c => Boolean(c.videoId));
    if (typeFilter === "Image") rows = rows.filter(c => !Boolean(c.videoId));
    if (campaignFilter) rows = rows.filter(c => String(c.campaign ?? "") === campaignFilter);
    rows = applyMetricFilter(rows, filters) as MetaCreativeRow[];
    rows.sort((a, b) => {
      const av = Number(a[sortKey] ?? 0);
      const bv = Number(b[sortKey] ?? 0);
      return sortOption.lowerBetter ? av - bv : bv - av;
    });
    return rows;
  }, [creative, typeFilter, campaignFilter, filters, sortKey, sortOption.lowerBetter]);

  // Mean of the rank metric across visible cards — drives green/red borders
  // (reference uses the mean of visible cards for creative colouring).
  const rankMean = useMemo(() => {
    const vals = filtered.map(c => Number(c[sortKey] ?? 0)).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }, [filtered, sortKey]);

  const tableRows = useMemo(
    () => filtered.map(c => ({ ...c, _type: c.videoId ? "Video" : "Image" })),
    [filtered]
  );

  if (creative.length === 0) {
    return (
      <div className="fade-in dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No creative data available for this window.
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header + controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Creative Performance
        </h3>
        <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          {filtered.length} of {creative.length} ad{creative.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Filter / sort / view controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-1">
          {(["All", "Video", "Image"] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: typeFilter === t ? "var(--gaf-primary)" : "var(--gaf-primary-light)",
                color: typeFilter === t ? "#fff" : "var(--gaf-primary)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Campaign filter */}
        {campaignNames.length > 0 && (
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            className="text-xs rounded border px-2 py-1 max-w-[240px]"
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

        {/* Sort by */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>Rank by:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            className="text-xs rounded border px-2 py-1"
            style={{
              borderColor: "var(--gaf-card-border)",
              color: "var(--gaf-text-primary)",
              background: "var(--gaf-card-bg)",
            }}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto">
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

      {/* Metric filter */}
      <div className="dash-card p-3 sm:p-4">
        <MetricFilter
          filters={filters}
          onChange={setFilters}
          metrics={CREATIVE_FILTER_METRICS}
        />
      </div>

      {/* Cards view */}
      {viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c, i) => {
            const isVideo = Boolean(c.videoId);
            const name = c.adName ?? c.title ?? "Untitled ad";
            const thumb = c.thumbnailUrl || c.imageUrl;
            const isTop3 = i < 3;
            const rankVal = Number(c[sortKey] ?? 0);
            const beatsMean = rankMean > 0 && (sortOption.lowerBetter ? rankVal <= rankMean : rankVal >= rankMean);
            const border = isTop3
              ? "2px solid var(--gaf-primary)"
              : `1px solid ${beatsMean ? "#d1fae5" : "#fee2e2"}`;
            const zero = (n: number) => n === 0;
            return (
              <div
                key={c.adId ?? i}
                className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-shadow hover:shadow-lg bg-white"
                style={{ border, boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06)" }}
                onClick={() => setSelectedCreative(c)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setSelectedCreative(c); }}
                aria-label={`View details for ${name}`}
              >
                {/* Media strip — near-black, contain (reference parity) */}
                <div className="relative" style={{ background: "#0a0a0a" }}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={String(name)}
                      loading="lazy"
                      className="w-full object-contain"
                      style={{ maxHeight: 220, minHeight: 160 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full flex items-center justify-center text-xs" style={{ height: 160, color: "#9ca3af" }}>
                      No preview
                    </div>
                  )}
                  {isVideo && <PlayOverlay />}
                  <span
                    className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: "var(--gaf-primary)" }}
                  >
                    {i + 1}
                  </span>
                </div>

                <div className="p-3.5 flex flex-col gap-2.5 min-w-0 flex-1">
                  {/* Pills: type + objective */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        background: isVideo ? "#f5f3ff" : "#eff6ff",
                        color: isVideo ? "#7c3aed" : "#2563eb",
                      }}
                    >
                      {isVideo ? "Video" : "Image"}
                    </span>
                    <ObjectivePill objective={c.objective} />
                  </div>

                  {/* Name + campaign */}
                  <div className="min-w-0">
                    <p
                      className="text-sm font-bold leading-snug line-clamp-2"
                      style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
                      title={String(name)}
                    >
                      {String(name)}
                    </p>
                    {Boolean(c.campaign) && (
                      <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--gaf-text-muted)" }} title={String(c.campaign)}>
                        {String(c.campaign)}
                      </p>
                    )}
                  </div>

                  {/* Highlighted rank metric */}
                  <div
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: isTop3 ? "var(--gaf-primary-light)" : beatsMean ? "#f0fdf4" : "#fef2f2",
                    }}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--gaf-text-secondary)" }}>
                      {sortOption.label.replace(" (low is better)", "")}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{
                        color: isTop3 ? "var(--gaf-primary)" : beatsMean ? "#059669" : "#dc2626",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {sortOption.fmt(rankVal)}
                    </span>
                  </div>

                  {/* 12-stat grid (reference parity) */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-1.5 mt-auto">
                    <Stat label="Spend"    value={fmtCurrencyCompact(Number(c.spend ?? 0))} />
                    <Stat label="ATC"      value={fmtInt(Number(c.addToCart ?? 0))}        dash={zero(Number(c.addToCart ?? 0))} />
                    <Stat label="ATC Rate" value={fmtPct(Number(c.atcRate ?? 0))}          dash={zero(Number(c.atcRate ?? 0))} />
                    <Stat label="Eng."     value={fmtCompact(Number(c.engagements ?? 0))}  dash={zero(Number(c.engagements ?? 0))} />
                    <Stat label="Eng. Rate" value={fmtPct(Number(c.engagementRate ?? 0))}  dash={zero(Number(c.engagementRate ?? 0))} />
                    <Stat label="Conv."    value={fmtInt(Number(c.purchases ?? 0))}        dash={zero(Number(c.purchases ?? 0))} />
                    <Stat label="ROAS"     value={fmtRoas(Number(c.roas ?? 0))}            dash={zero(Number(c.roas ?? 0))} />
                    <Stat label="CTR"      value={fmtPct(Number(c.ctr ?? 0))} />
                    <Stat label="OB CTR"   value={fmtPct(Number(c.impressions ?? 0) > 0 ? (Number(c.outboundClicks ?? 0) / Number(c.impressions ?? 1)) * 100 : 0)} />
                    <Stat label="LPV"      value={fmtCompact(Number(c.landingPageViews ?? 0))} dash={zero(Number(c.landingPageViews ?? 0))} />
                    <Stat label="CPC"      value={fmtCpc(Number(c.cpc ?? 0))} />
                    <Stat label="Revenue"  value={fmtCurrencyCompact(Number(c.purchaseValue ?? 0))} dash={zero(Number(c.purchaseValue ?? 0))} />
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
          rows={tableRows as Record<string, unknown>[]}
          sortable
        />
      )}

      <p className="text-[11px]" style={{ color: "var(--gaf-text-muted)" }}>
        Top 3 by the rank metric carry an orange border; green/red borders compare each ad to the mean of the visible set.
        ROAS is directional only — many Revel sales close offline via phone.
      </p>

      {/* Modal */}
      <MetaCreativeModal
        creative={selectedCreative}
        onClose={() => setSelectedCreative(null)}
      />
    </div>
  );
}
