// src/tabs/Axon.tsx
// Axon (AppLovin) — mirrors the Google Ads tab structure: sub-tab nav,
// Overview with metric-toggle daily trend + top campaigns + spend split,
// then Campaigns and Creative Sets tables.
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { TrendChart } from "../components/TrendChart";
import { CaveatBanner } from "../components/CaveatBanner";
import { fmtCurrency, fmtCurrencyCompact, fmtCpc, fmtInt, fmtPct, fmtRoas } from "../lib/format";
import type { PerfData } from "../lib/data";

interface AxonProps {
  data: PerfData;
}

const LEARNING_CAVEAT =
  "Axon (AppLovin) launched 10 Jul 2026 and is in its 3 to 5 day learning phase; early data is thin and noisy. " +
  "Many GAF sales close offline via phone or in-store – ROAS figures are directional only.";

// ---- Sub-tab shell (mirrors GoogleAds.tsx) ----

type SubTab = "overview" | "campaigns" | "creativeSets";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview",     label: "Overview" },
  { key: "campaigns",    label: "Campaigns" },
  { key: "creativeSets", label: "Creative Sets" },
];

const METRIC_OPTIONS: { key: string; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "roas",  label: "ROAS" },
  { key: "ctr",   label: "CTR" },
];

// ---- Column definitions (Google-parity ordering) ----
// Feed rows key on `campaign` / `creativeSet` (NOT `name`).

type Row = Record<string, unknown>;

const CAMPAIGN_COLS = [
  { key: "campaign",    label: "Campaign",     align: "left"  as const },
  { key: "spend",       label: "Spend",        align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions", label: "Impr.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks",      label: "Clicks",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr",         label: "CTR",          align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "cpc",         label: "CPC",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
  { key: "cpm",         label: "CPM",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
  { key: "conversions", label: "Conv.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "sales",       label: "Conv. Value",  align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas",        label: "ROAS",         align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtRoas(Number(v)) : "–") },
  { key: "cpa",         label: "CPA",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
];

const CREATIVE_SET_COLS = [
  { key: "creativeSet", label: "Creative Set", align: "left"  as const },
  { key: "spend",       label: "Spend",        align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions", label: "Impr.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks",      label: "Clicks",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr",         label: "CTR",          align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "cpc",         label: "CPC",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
  { key: "cpm",         label: "CPM",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
  { key: "conversions", label: "Conv.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
];

// ---- Component ----

export function Axon({ data }: AxonProps) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("overview");
  const [activeMetric, setActiveMetric] = useState("spend");

  const axonWin = data.axon?.[window];

  if (!axonWin) {
    return (
      <div className="space-y-4 fade-in">
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No Axon data available for this window.
        </div>
        <CaveatBanner text={LEARNING_CAVEAT} />
      </div>
    );
  }

  const kpis         = axonWin.kpis        ?? {};
  const deltas       = axonWin.deltas      ?? {};
  const campaigns    = (axonWin.campaigns    ?? []) as Row[];
  const creativeSets = (axonWin.creativeSets ?? []) as Row[];
  const daily        = axonWin.daily        ?? [];

  const hasConversions = Number(kpis.conversions ?? 0) > 0;
  const metricLabel =
    activeMetric === "spend" ? "Ad Spend" : activeMetric === "roas" ? "ROAS" : "CTR";

  const topCampaigns = [...campaigns]
    .sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0))
    .slice(0, 8);

  const totalCsSpend = creativeSets.reduce((s, c) => s + Number(c.spend ?? 0), 0) || 1;
  const csSorted = [...creativeSets].sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0));

  return (
    <div className="p-0 space-y-6 fade-in">
      {/* Sub-tab pill nav */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="Axon sections"
      >
        {SUB_TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              style={{
                background: isActive ? "var(--gaf-primary)" : "transparent",
                color: isActive ? "#fff" : "var(--gaf-text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* --- Overview --- */}
      {active === "overview" && (
        <>
          <section aria-label="Axon key metrics">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
              <KpiCard label="Spend"       value={fmtCurrency(kpis.spend ?? 0)}   delta={deltas.spend ?? null} />
              <KpiCard label="Impressions" value={fmtInt(kpis.impressions ?? 0)}  delta={deltas.impressions ?? null} />
              <KpiCard label="Clicks"      value={fmtInt(kpis.clicks ?? 0)}       delta={deltas.clicks ?? null} />
              <KpiCard label="CTR"         value={fmtPct(kpis.ctr ?? 0)}          delta={deltas.ctr ?? null} />
              <KpiCard label="CPC"         value={fmtCpc(kpis.cpc ?? 0)}          delta={deltas.cpc ?? null}   invertDelta tooltip="Spend ÷ clicks. Lower is better." />
              <KpiCard label="CPM"         value={fmtCpc(kpis.cpm ?? 0)}          delta={deltas.cpm ?? null}   invertDelta tooltip="Cost per 1,000 impressions. Lower is better." />
              <KpiCard
                label="Add to Cart"
                value={fmtInt(kpis.gaAtc ?? 0)}
                delta={deltas.gaAtc ?? null}
                subLabel={`of ${fmtInt(kpis.gaSessions ?? 0)} GA4 sessions`}
                tooltip={
                  "Measured in GA4, not AppLovin. Add-to-cart events from the Axon channel " +
                  "(source=axon / medium=paid), Australia only. AppLovin can't optimise toward " +
                  "or report add-to-cart, so GA4 is the source of truth for it. This is the " +
                  "number to watch move off zero as the deep-linked creative beds in."
                }
              />
              <KpiCard label="Conversions" value={fmtInt(kpis.conversions ?? 0)}  delta={deltas.conversions ?? null} />
              <KpiCard label="Conv. Value" value={fmtCurrency(kpis.sales ?? 0)}   delta={deltas.sales ?? null} />
              <KpiCard label="ROAS"        value={hasConversions ? fmtRoas(kpis.roas ?? 0) : "–"} delta={hasConversions ? deltas.roas ?? null : null} />
              <KpiCard label="CPA"         value={hasConversions ? fmtCpc(kpis.cpa ?? 0) : "–"}   delta={hasConversions ? deltas.cpa ?? null : null} invertDelta />
            </div>

            {/* Learning-phase disclaimer (mirrors Google's offline note) */}
            <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: "var(--gaf-text-muted)" }}>
              <span aria-hidden="true">&#9432;</span>
              <span>
                Campaign launched 10 Jul 2026 and is in its learning phase – early data is thin and noisy.
              </span>
            </p>
          </section>

          {/* Daily trend with metric toggle (mirrors Google) */}
          {daily.length > 0 && (
            <div className="dash-card p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3
                  className="text-lg font-bold"
                  style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
                >
                  Daily trend
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

          {/* Top campaigns by spend (mirrors Google) */}
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
              {topCampaigns.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 py-2"
                  style={{ borderBottom: "1px solid var(--gaf-row-border)" }}
                >
                  <span
                    className="flex-1 truncate text-sm font-medium"
                    style={{ color: "var(--gaf-text-primary)" }}
                  >
                    {String(c.campaign ?? "")}
                  </span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--gaf-text-muted)" }}>
                    {fmtInt(Number(c.conversions ?? 0))} conv
                  </span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: "var(--gaf-text-secondary)" }}>
                    {Number(c.roas ?? 0) > 0 ? fmtRoas(Number(c.roas)) : "–"}
                  </span>
                  <span className="text-sm font-bold ml-3 flex-shrink-0 tabular-nums" style={{ color: "var(--gaf-text-primary)" }}>
                    {fmtCurrency(Number(c.spend ?? 0))}
                  </span>
                </div>
              ))}
              {topCampaigns.length === 0 && (
                <p className="text-sm py-4 text-center" style={{ color: "var(--gaf-text-muted)" }}>No campaign data.</p>
              )}
            </div>
          </div>

          {/* Spend by creative set (mirrors Google's spend by channel) */}
          {csSorted.length > 0 && (
            <div className="dash-card p-5">
              <h3
                className="text-lg font-bold mb-4"
                style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
              >
                Spend by creative set
              </h3>
              <div className="space-y-3">
                {csSorted.map((c, i) => {
                  const spend = Number(c.spend ?? 0);
                  const pct = (spend / totalCsSpend) * 100;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--gaf-text-primary)" }}>
                          {String(c.creativeSet ?? "")}
                        </span>
                        <div className="flex items-center gap-4 text-xs tabular-nums" style={{ color: "var(--gaf-text-secondary)" }}>
                          <span>{fmtPct(Number(c.ctr ?? 0))} CTR</span>
                          <span>{pct.toFixed(1)}%</span>
                          <span className="font-semibold" style={{ color: "var(--gaf-text-primary)" }}>
                            {fmtCurrency(spend)}
                          </span>
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

          <CaveatBanner text={LEARNING_CAVEAT} />
        </>
      )}

      {/* --- Campaigns --- */}
      {active === "campaigns" && (
        <div className="space-y-4">
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Campaign Performance
          </h3>
          <DataTable<Row> columns={CAMPAIGN_COLS} rows={campaigns} sortable />
          <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
            All figures reflect the selected window.
          </p>
        </div>
      )}

      {/* --- Creative Sets --- */}
      {active === "creativeSets" && (
        <div className="space-y-4">
          <h3
            className="text-lg font-bold"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            Creative Set Performance
          </h3>
          {creativeSets.length > 0 ? (
            <DataTable<Row> columns={CREATIVE_SET_COLS} rows={creativeSets} sortable />
          ) : (
            <p
              className="text-xs italic rounded-lg px-3 py-2"
              style={{ color: "var(--gaf-text-muted)", background: "#f9fafb", border: "1px solid var(--gaf-row-border)" }}
            >
              Creative set data is not yet available. Campaign Management API access is pending – creative-level reporting will appear here once enabled.
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
            All figures reflect the selected window.
          </p>
        </div>
      )}
    </div>
  );
}
