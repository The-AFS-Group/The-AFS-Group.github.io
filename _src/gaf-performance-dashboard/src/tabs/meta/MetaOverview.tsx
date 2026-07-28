// src/tabs/meta/MetaOverview.tsx
import { useState, useCallback } from "react";
import { KpiCard } from "../../components/KpiCard";
import { TrendChart } from "../../components/TrendChart";
import { fmtCurrency, fmtCpc, fmtCurrencyCompact, fmtInt, fmtPct, fmtRoas } from "../../lib/format";
import { METRIC_TOOLTIPS } from "./columns";
import { refreshMeta } from "../../lib/meta-live";
import type { MetaLiveKpis } from "../../lib/meta-live";
import type { MetaWindow, MetaKpis, Window } from "../../lib/data";
import { CampaignTierPanel, BudgetAtRiskPanel, ScaleWinnersPanel } from "./MetaDecisionPanels";

interface MetaOverviewProps {
  metaWin: MetaWindow;
  window: Window;
}

// ---- Live refresh state ----

type LiveState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "live"; kpis: MetaLiveKpis; fetchedAt: string }
  | { status: "error"; message: string };

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// KPI card descriptor. invert = lower-is-better (cost metrics).
interface KpiDef {
  key: keyof MetaKpis;
  label: string;
  fmt: (n: number) => string;
  invert?: boolean;
}

// Cost-per metrics use fmtCpc — fmtCurrency rounds a $0.45 CPC to "$0".
const KPI_DEFS: KpiDef[] = [
  { key: "spend",            label: "Total Spend",   fmt: fmtCurrency },
  { key: "impressions",      label: "Impressions",   fmt: fmtInt },
  { key: "reach",            label: "Reach",         fmt: fmtInt },
  { key: "clicks",           label: "Clicks",        fmt: fmtInt },
  { key: "ctr",              label: "CTR",           fmt: fmtPct },
  { key: "cpc",              label: "CPC",           fmt: fmtCpc, invert: true },
  { key: "cpm",              label: "CPM",           fmt: fmtCpc, invert: true },
  { key: "outboundClicks",   label: "Outbound Clicks", fmt: fmtInt },
  { key: "outboundCtr",      label: "Outbound CTR",  fmt: fmtPct },
  { key: "landingPageViews", label: "Landing Page Views", fmt: fmtInt },
  { key: "addToCart",        label: "Add to Cart",   fmt: fmtInt },
  { key: "atcRate",          label: "ATC Rate",      fmt: fmtPct },
  { key: "costPerAtc",       label: "Cost / ATC",    fmt: fmtCpc, invert: true },
  { key: "conversions",      label: "Conversions",   fmt: fmtInt },
  { key: "cpa",              label: "Cost / Conv.",  fmt: fmtCpc, invert: true },
  { key: "convValue",        label: "Revenue",       fmt: fmtCurrency },
  { key: "roas",             label: "ROAS",          fmt: fmtRoas },
];

const KPI_TOOLTIP_KEYS: Record<string, string> = {
  spend: "spend", impressions: "impressions", reach: "reach", clicks: "clicks",
  ctr: "ctr", cpc: "cpc", cpm: "cpm", outboundClicks: "outboundClicks",
  outboundCtr: "outboundCtr", landingPageViews: "landingPageViews",
  addToCart: "addToCart", atcRate: "atcRate", costPerAtc: "costPerAtc",
  conversions: "conversions", cpa: "cpa", convValue: "convValue", roas: "roas",
};

export function MetaOverview({ metaWin, window }: MetaOverviewProps) {
  const [liveState, setLiveState] = useState<LiveState>({ status: "idle" });

  const handleRefresh = useCallback(async () => {
    setLiveState({ status: "loading" });
    try {
      const result = await refreshMeta(window);
      setLiveState({ status: "live", kpis: result.kpis, fetchedAt: result.fetchedAt });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Live refresh failed. Showing snapshot.";
      setLiveState({ status: "error", message });
    }
  }, [window]);

  const snapKpis: MetaKpis = metaWin.kpis ?? {};
  const deltas = metaWin.deltas ?? {};
  const daily = metaWin.daily ?? [];

  const isLive = liveState.status === "live";
  const isLoading = liveState.status === "loading";

  // Merge live KPIs over snapshot when available (live returns a subset).
  const liveKpis: Partial<MetaKpis> =
    isLive ? (liveState.kpis as unknown as Partial<MetaKpis>) : {};
  const kpis: MetaKpis = isLive ? { ...snapKpis, ...liveKpis } : snapKpis;

  return (
    <div className="space-y-6 fade-in">
      {/* Header: title + live badge + Refresh live button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Performance Overview
          </h3>
          {isLive && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ background: "var(--gaf-primary-light)", color: "var(--gaf-primary)" }}
              aria-label={`Live data as of ${fmtTime(liveState.fetchedAt)}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--gaf-primary)" }}
                aria-hidden="true"
              />
              Live as of {fmtTime(liveState.fetchedAt)}
            </span>
          )}
          {liveState.status === "error" && (
            <span className="text-xs truncate max-w-xs" style={{ color: "var(--gaf-delta-neg)" }} role="alert">
              {liveState.message.length > 80
                ? liveState.message.slice(0, 77) + "..."
                : liveState.message}
            </span>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isLoading}
          aria-label={isLoading ? "Refreshing live Meta data..." : "Refresh live Meta data"}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-150 focus:outline-none focus:ring-2"
          style={{
            borderColor: "var(--gaf-primary)",
            color: isLoading ? "var(--gaf-text-muted)" : "var(--gaf-primary)",
            background: "var(--gaf-primary-light)",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? (
            <>
              <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh live
            </>
          )}
        </button>
      </div>

      {/* KPI grid */}
      <section aria-label="Meta Ads key metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 stagger">
          {KPI_DEFS.map((def) => {
            const raw = kpis[def.key];
            const value = def.fmt(typeof raw === "number" ? raw : 0);
            // On live refresh only some KPIs update; suppress deltas that no longer match snapshot period.
            const delta = isLive ? null : (deltas[def.key as string] ?? null);
            return (
              <KpiCard
                key={def.key as string}
                label={def.label}
                value={value}
                delta={delta}
                invertDelta={def.invert}
                tooltip={METRIC_TOOLTIPS[KPI_TOOLTIP_KEYS[def.key as string] ?? ""]}
              />
            );
          })}
        </div>
      </section>

      {/* Daily trend chart */}
      {daily.length > 0 ? (
        <section className="dash-card p-5 sm:p-6" aria-label="Daily spend trend">
          <h3
            className="text-lg font-bold mb-4"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Performance Trend
          </h3>
          <TrendChart
            data={daily as Array<{ date: string; [k: string]: number | string }>}
            series={{ areas: [{ key: "spend", color: "var(--gaf-primary)", label: "Ad Spend", format: fmtCurrencyCompact }] }}
          />
        </section>
      ) : (
        <section className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No daily trend data in this window.
        </section>
      )}

      {/* Decision panels — always benchmarked on the SNAPSHOT campaign data,
          never on live-merged KPIs (live refresh must not reshuffle tiers) */}
      <CampaignTierPanel campaigns={metaWin.campaigns ?? []} />
      <BudgetAtRiskPanel campaigns={metaWin.campaigns ?? []} />
      <ScaleWinnersPanel adsets={metaWin.adsets ?? []} campaigns={metaWin.campaigns ?? []} />
    </div>
  );
}
