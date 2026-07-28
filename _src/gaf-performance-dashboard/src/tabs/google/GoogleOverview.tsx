// src/tabs/google/GoogleOverview.tsx
import { useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { TrendChart } from "../../components/TrendChart";
import { CaveatBanner } from "../../components/CaveatBanner";
import { fmtCpc, fmtCurrency, fmtCurrencyCompact, fmtInt, fmtPct, fmtRoas } from "../../lib/format";

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

const METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "roas",  label: "ROAS" },
  { key: "ctr",   label: "CTR" },
];

interface Props {
  googleWin: Record<string, any>;
}

export function GoogleOverview({ googleWin }: Props) {
  const [activeMetric, setActiveMetric] = useState("spend");

  const kpis = googleWin.kpis ?? {};
  const deltas = googleWin.deltas ?? {};
  const campaigns = (googleWin.campaigns ?? []) as Record<string, any>[];
  const daily = (googleWin.daily ?? []) as Array<{ date: string; [k: string]: number | string }>;

  const metricLabel =
    activeMetric === "spend" ? "Ad Spend" : activeMetric === "roas" ? "ROAS" : "CTR";

  // Spend by channel aggregation — feed field is `channel`
  const channelMap = new Map<string, { spend: number; convValue: number }>();
  for (const c of campaigns) {
    const ch = (c.channel as string) ?? "UNKNOWN";
    const existing = channelMap.get(ch) ?? { spend: 0, convValue: 0 };
    channelMap.set(ch, {
      spend: existing.spend + (c.spend ?? 0),
      convValue: existing.convValue + (c.convValue ?? 0),
    });
  }
  const channelRows = [...channelMap.entries()].sort((a, b) => b[1].spend - a[1].spend);
  const totalSpend = channelRows.reduce((s, [, v]) => s + v.spend, 0) || 1;

  const topCampaigns = [...campaigns]
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-6 fade-in">
      {/* KPI grid */}
      <section aria-label="Google Ads key metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
          <KpiCard label="Spend"              value={fmtCurrency(kpis.spend ?? 0)}           delta={deltas.spend ?? null}
                   tooltip="Total amount spent on Google Ads in the selected window." />
          <KpiCard label="Impressions"        value={fmtInt(kpis.impressions ?? 0)}           delta={deltas.impressions ?? null}
                   tooltip="Number of times your ads were shown." />
          <KpiCard label="Clicks"             value={fmtInt(kpis.clicks ?? 0)}               delta={deltas.clicks ?? null}
                   tooltip="Number of clicks on your ads." />
          <KpiCard label="CTR"                value={fmtPct(kpis.ctr ?? 0)}                  delta={deltas.ctr ?? null}
                   tooltip="Click-through rate — clicks ÷ impressions." />
          <KpiCard label="Avg CPC"            value={fmtCpc(kpis.avgCpc ?? 0)}              delta={deltas.avgCpc ?? null}          invertDelta
                   tooltip="Average cost per click — spend ÷ clicks. Lower is better." />
          <KpiCard label="CPM"                value={fmtCpc(kpis.cpm ?? 0)}                 delta={deltas.cpm ?? null}             invertDelta
                   tooltip="Cost per 1,000 impressions — spend ÷ impressions × 1000. Lower is better." />
          <KpiCard label="Conversions"        value={(kpis.conversions ?? 0).toFixed(1)}     delta={deltas.conversions ?? null}
                   tooltip="Primary conversions (purchases) Google Ads attributes to your ads." />
          <KpiCard label="Conv. Value"        value={fmtCurrency(kpis.convValue ?? 0)}       delta={deltas.convValue ?? null}
                   tooltip="Total revenue value of those primary conversions." />
          <KpiCard label="ROAS"               value={fmtRoas(kpis.roas ?? 0)}               delta={deltas.roas ?? null}
                   tooltip="Return on ad spend — conversion value ÷ spend. Directional only: many GAF sales close offline." />
          <KpiCard label="CPA"                value={fmtCurrency(kpis.cpa ?? 0)}            delta={deltas.cpa ?? null}             invertDelta
                   tooltip="Cost per acquisition — spend ÷ conversions. Lower is better." />
          <KpiCard label="Add to Cart"        value={fmtInt(kpis.atc ?? 0)}                 delta={deltas.atc ?? null}
                   tooltip="Add-to-cart events attributed to Google Ads. A secondary conversion — not counted in ROAS." />
          <KpiCard label="ATC Rate"           value={fmtPct(kpis.atcRate ?? 0)}             delta={deltas.atcRate ?? null}
                   tooltip="Add-to-cart rate — add-to-carts ÷ clicks." />
          <KpiCard label="Cost / ATC"         value={fmtCpc(kpis.costPerAtc ?? 0)}          delta={deltas.costPerAtc ?? null}      invertDelta
                   tooltip="Spend ÷ add-to-carts. Lower is better. ATC is account-level (Shopping conversion action)." />
          <KpiCard label="Search Impr. Share" value={kpis.searchImprShare == null ? "n/a" : fmtPct(kpis.searchImprShare)} delta={null}
                   tooltip="The % of available Search impressions your ads actually received. Low = you're missing reachable demand." />
        </div>

        {/* Offline disclaimer */}
        <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          <span aria-hidden="true">&#9432;</span>
          <span>
            Many GAF purchases close offline via phone or sales team. Conversions, ROAS and CPA
            understate phone-closing campaigns – treat as directional signals, not a verdict.
          </span>
        </p>
      </section>

      {/* Daily Trend */}
      {daily.length > 0 && (
        <div className="dash-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3
              className="text-lg font-bold"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              Daily trend · last 90 days
            </h3>
            <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100">
              {METRIC_OPTIONS.map((opt) => {
                const isActive = activeMetric === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setActiveMetric(opt.key)}
                    className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                    style={{
                      background: isActive ? "var(--gaf-primary)" : "transparent",
                      color: isActive ? "#fff" : "var(--gaf-text-secondary)",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <TrendChart
            data={daily}
            series={{ areas: [{
              key: activeMetric,
              color: "var(--gaf-primary)",
              label: metricLabel,
              format:
                activeMetric === "roas" ? (v: number) => `${v.toFixed(2)}x`
                : activeMetric === "ctr" ? (v: number) => `${v.toFixed(1)}%`
                : fmtCurrencyCompact,
            }] }}
          />
        </div>
      )}

      {/* Top campaigns by spend */}
      <div className="dash-card p-5">
        <div className="mb-3">
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Top campaigns by spend
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--gaf-text-muted)" }}>
            Conversions &amp; ROAS shown for reference only.
          </p>
        </div>
        <div className="space-y-2">
          {topCampaigns.map((c, i) => {
            const chKey = (c.channel as string) ?? "";
            const chLabel = CHANNEL_LABELS[chKey] || chKey || "";
            return (
              <div
                key={i}
                className="flex items-center gap-2 py-2"
                style={{ borderBottom: "1px solid var(--gaf-row-border)" }}
              >
                {chLabel && (
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium flex-shrink-0">
                    {chLabel}
                  </span>
                )}
                <span
                  className="flex-1 truncate text-sm font-medium"
                  style={{ color: "var(--gaf-text-primary)" }}
                >
                  {c.name ?? ""}
                </span>
                <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--gaf-text-muted)" }}>
                  {(Number(c.conversions ?? 0)).toFixed(1)} conv
                </span>
                <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--gaf-text-secondary)" }}>
                  {fmtRoas(c.roas ?? 0)}
                </span>
                <span className="text-sm font-bold ml-3 flex-shrink-0 tabular-nums" style={{ color: "var(--gaf-text-primary)" }}>
                  {fmtCurrency(c.spend ?? 0)}
                </span>
              </div>
            );
          })}
          {topCampaigns.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--gaf-text-muted)" }}>No campaign data.</p>
          )}
        </div>
      </div>

      {/* Spend by channel */}
      <div className="dash-card p-5">
        <h3
          className="text-lg font-bold mb-4"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Spend by channel
        </h3>
        <div className="space-y-3">
          {channelRows.map(([ch, { spend, convValue }]) => {
            const label = CHANNEL_LABELS[ch] || ch || "Other";
            const roas = convValue / (spend || 1);
            const pct = (spend / totalSpend) * 100;
            return (
              <div key={ch} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium" style={{ color: "var(--gaf-text-primary)" }}>{label}</span>
                  <div className="flex items-center gap-4 text-xs tabular-nums" style={{ color: "var(--gaf-text-secondary)" }}>
                    <span>{fmtRoas(roas)}</span>
                    <span>{pct.toFixed(1)}%</span>
                    <span className="font-semibold" style={{ color: "var(--gaf-text-primary)" }}>
                      {fmtCurrency(spend)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--gaf-primary)" }}
                  />
                </div>
              </div>
            );
          })}
          {channelRows.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--gaf-text-muted)" }}>No channel data.</p>
          )}
        </div>
      </div>

      <CaveatBanner text="Many GAF sales close offline via phone or in-store. ROAS and conversion figures are directional only – not a performance verdict." />
    </div>
  );
}
