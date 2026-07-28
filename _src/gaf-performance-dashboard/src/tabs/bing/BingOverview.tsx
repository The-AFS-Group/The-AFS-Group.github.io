// src/tabs/bing/BingOverview.tsx
import { useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { TrendChart } from "../../components/TrendChart";
import { CaveatBanner } from "../../components/CaveatBanner";
import { fmtCpc, fmtCurrency, fmtCurrencyCompact, fmtInt, fmtPct, fmtRoas } from "../../lib/format";

const METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "ctr", label: "CTR" },
  { key: "clicks", label: "Clicks" },
];

interface Props {
  bingWin: Record<string, any>;
}

export function BingOverview({ bingWin }: Props) {
  const [activeMetric, setActiveMetric] = useState("spend");

  const kpis = bingWin.kpis ?? {};
  const deltas = bingWin.deltas ?? {};
  const campaigns = (bingWin.campaigns ?? []) as Record<string, any>[];
  const daily = (bingWin.daily ?? []) as Array<{ date: string; [k: string]: number | string }>;

  const metricLabel =
    activeMetric === "spend" ? "Ad Spend" : activeMetric === "clicks" ? "Clicks" : "CTR";

  // Spend by campaign type (Bing's `channel` field carries CampaignType)
  const typeMap = new Map<string, number>();
  for (const c of campaigns) {
    const t = (c.channel as string) || "Bing";
    typeMap.set(t, (typeMap.get(t) ?? 0) + (c.spend ?? 0));
  }
  const typeRows = [...typeMap.entries()].sort((a, b) => b[1] - a[1]);
  const totalSpend = typeRows.reduce((s, [, v]) => s + v, 0) || 1;

  const topCampaigns = [...campaigns].sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0)).slice(0, 8);
  const noConversions = (kpis.conversions ?? 0) === 0;

  return (
    <div className="space-y-6 fade-in">
      <section aria-label="Microsoft Ads key metrics">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
          <KpiCard label="Spend"        value={fmtCurrency(kpis.spend ?? 0)}     delta={deltas.spend ?? null}
                   tooltip="Total amount spent on Microsoft Advertising in the selected window." />
          <KpiCard label="Impressions"  value={fmtInt(kpis.impressions ?? 0)}    delta={deltas.impressions ?? null}
                   tooltip="Number of times your ads were shown." />
          <KpiCard label="Clicks"       value={fmtInt(kpis.clicks ?? 0)}         delta={deltas.clicks ?? null}
                   tooltip="Number of clicks on your ads." />
          <KpiCard label="CTR"          value={fmtPct(kpis.ctr ?? 0)}            delta={deltas.ctr ?? null}
                   tooltip="Click-through rate — clicks ÷ impressions." />
          <KpiCard label="Avg CPC"      value={fmtCpc(kpis.avgCpc ?? 0)}         delta={deltas.avgCpc ?? null} invertDelta
                   tooltip="Average cost per click — spend ÷ clicks. Lower is better." />
          <KpiCard label="CPM"          value={fmtCpc(kpis.cpm ?? 0)}            delta={deltas.cpm ?? null}    invertDelta
                   tooltip="Cost per 1,000 impressions — spend ÷ impressions × 1000. Lower is better." />
          <KpiCard label="Conversions"  value={(kpis.conversions ?? 0).toFixed(1)} delta={deltas.conversions ?? null}
                   tooltip="Conversions Microsoft Advertising attributes to your ads (requires UET conversion tracking)." />
          <KpiCard label="Conv. Value"  value={fmtCurrency(kpis.convValue ?? 0)} delta={deltas.convValue ?? null}
                   tooltip="Revenue value of those conversions." />
          <KpiCard label="ROAS"         value={fmtRoas(kpis.roas ?? 0)}          delta={deltas.roas ?? null}
                   tooltip="Return on ad spend — conversion value ÷ spend. Directional only: many GAF sales close offline." />
          <KpiCard label="CPA"          value={fmtCurrency(kpis.cpa ?? 0)}       delta={deltas.cpa ?? null}    invertDelta
                   tooltip="Cost per acquisition — spend ÷ conversions. Lower is better." />
        </div>

        {noConversions && (
          <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: "var(--gaf-text-muted)" }}>
            <span aria-hidden="true">&#9432;</span>
            <span>
              No conversions recorded — Microsoft Advertising UET conversion tracking does not appear to
              be configured on this account, so Conversions, ROAS and CPA read zero. Spend, clicks and
              impressions are accurate. Worth wiring UET to unlock conversion reporting.
            </span>
          </p>
        )}
      </section>

      {/* Daily Trend */}
      {daily.length > 0 && (
        <div className="dash-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="text-lg font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
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
                    style={{ background: isActive ? "var(--gaf-primary)" : "transparent", color: isActive ? "#fff" : "var(--gaf-text-secondary)" }}
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
                activeMetric === "ctr" ? (v: number) => `${v.toFixed(1)}%`
                : activeMetric === "clicks" ? (v: number) => fmtInt(v)
                : fmtCurrencyCompact,
            }] }}
          />
        </div>
      )}

      {/* Top campaigns by spend */}
      <div className="dash-card p-5">
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Top campaigns by spend
        </h3>
        <div className="space-y-2">
          {topCampaigns.map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--gaf-row-border)" }}>
              {c.channel && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium flex-shrink-0">
                  {String(c.channel)}
                </span>
              )}
              <span className="flex-1 truncate text-sm font-medium" style={{ color: "var(--gaf-text-primary)" }}>{c.name ?? ""}</span>
              <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--gaf-text-muted)" }}>{fmtInt(c.clicks ?? 0)} clicks</span>
              <span className="text-sm font-bold ml-3 flex-shrink-0 tabular-nums" style={{ color: "var(--gaf-text-primary)" }}>{fmtCurrency(c.spend ?? 0)}</span>
            </div>
          ))}
          {topCampaigns.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: "var(--gaf-text-muted)" }}>No campaign data.</p>
          )}
        </div>
      </div>

      {/* Spend by campaign type */}
      {typeRows.length > 1 && (
        <div className="dash-card p-5">
          <h3 className="text-lg font-bold mb-4" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
            Spend by campaign type
          </h3>
          <div className="space-y-3">
            {typeRows.map(([t, spend]) => {
              const pct = (spend / totalSpend) * 100;
              return (
                <div key={t} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--gaf-text-primary)" }}>{t}</span>
                    <div className="flex items-center gap-4 text-xs tabular-nums" style={{ color: "var(--gaf-text-secondary)" }}>
                      <span>{pct.toFixed(1)}%</span>
                      <span className="font-semibold" style={{ color: "var(--gaf-text-primary)" }}>{fmtCurrency(spend)}</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gaf-primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CaveatBanner text="Many GAF sales close offline via phone or in-store. ROAS and conversion figures are directional only – not a performance verdict." />
    </div>
  );
}
