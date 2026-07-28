// src/tabs/SeoAeo.tsx
// SEO / AEO: Google Search Console performance + AI-engine (answer engine)
// traffic from GA4 — sub-tabbed like the Meta/Google tabs.
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { TrendChart } from "../components/TrendChart";
import { CaveatBanner } from "../components/CaveatBanner";
import { fmtCompact, fmtCurrency, fmtInt, fmtPct } from "../lib/format";
import type { PerfData } from "../lib/data";

interface Props {
  data: PerfData;
}

type SubTab = "search" | "ai" | "queries" | "pages";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "search",  label: "Search Performance" },
  { key: "ai",      label: "AI Engines" },
  { key: "queries", label: "Top Queries" },
  { key: "pages",   label: "Top Pages" },
];

type Row = Record<string, unknown>;

const QUERY_COLS = [
  { key: "query",       label: "Query",       align: "left"  as const },
  { key: "clicks",      label: "Clicks",      align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "impressions", label: "Impressions", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr",         label: "CTR",         align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "position",    label: "Avg Position", align: "right" as const, format: (v: unknown) => Number(v ?? 0).toFixed(1) },
];

const PAGE_COLS = [
  { key: "page",        label: "Page",        align: "left"  as const,
    format: (v: unknown) => String(v ?? "").replace("https://www.gymandfitness.com.au", "") || "/" },
  { key: "clicks",      label: "Clicks",      align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "impressions", label: "Impressions", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr",         label: "CTR",         align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "position",    label: "Avg Position", align: "right" as const, format: (v: unknown) => Number(v ?? 0).toFixed(1) },
];

const AI_SOURCE_COLS = [
  { key: "source",      label: "AI Engine",   align: "left"  as const },
  { key: "sessions",    label: "Sessions",    align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "conversions", label: "Conversions", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "revenue",     label: "Revenue",     align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-lg font-bold mb-3"
      style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
    >
      {children}
    </h3>
  );
}

export function SeoAeo({ data }: Props) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("search");

  const seoWin = data.seo?.[window];
  const aiTraffic = data.ga4?.[window]?.aiTraffic;

  if (!seoWin && !aiTraffic) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No SEO / AEO data available for this window.
      </div>
    );
  }

  const kpis = seoWin?.kpis ?? {};
  const deltas = seoWin?.deltas ?? {};
  const aiKpis = aiTraffic?.kpis ?? {};
  const aiDeltas = aiTraffic?.deltas ?? {};

  return (
    <div className="space-y-6 fade-in">
      {/* Sub-tab pill nav */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="SEO and AEO sections"
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

      {/* --- Search performance (Search Console) --- */}
      {active === "search" && (
        <>
          <section aria-label="Search Console key metrics">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
              <KpiCard
                label="Search Clicks"
                value={fmtInt(kpis.clicks ?? 0)}
                delta={deltas.clicks ?? null}
                tooltip="Clicks from Google Search results (Search Console)."
              />
              <KpiCard
                label="Impressions"
                value={fmtInt(kpis.impressions ?? 0)}
                delta={deltas.impressions ?? null}
                tooltip="Times gymandfitness.com.au appeared in Google Search."
              />
              <KpiCard
                label="CTR"
                value={fmtPct(kpis.ctr ?? 0)}
                delta={deltas.ctr ?? null}
                tooltip="Search clicks ÷ impressions."
              />
              <KpiCard
                label="Avg Position"
                value={(kpis.position ?? 0).toFixed(1)}
                delta={deltas.position ?? null}
                invertDelta
                tooltip="Impression-weighted average ranking position. Lower is better."
              />
              <KpiCard
                label="AI Engine Sessions"
                value={fmtInt(aiKpis.sessions ?? 0)}
                delta={aiDeltas.sessions ?? null}
                tooltip="GA4 sessions arriving from AI answer engines (ChatGPT, Perplexity, Gemini, Copilot, Claude…)."
              />
            </div>
          </section>

          {(seoWin?.daily?.length ?? 0) > 0 && (
            <section className="dash-card p-5" aria-label="Daily search clicks">
              <SectionTitle>Daily Search Clicks</SectionTitle>
              <TrendChart
                data={seoWin!.daily!}
                series={{ areas: [{ key: "clicks", color: "var(--gaf-primary)", label: "Clicks", format: fmtCompact }] }}
              />
            </section>
          )}

          {seoWin?.dataThrough && (
            <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
              Search Console data lags ~2 days — this window covers data through {seoWin.dataThrough}, with the comparison period shifted to match.
            </p>
          )}
        </>
      )}

      {/* --- AI engines (AEO) --- */}
      {active === "ai" && (
        <>
          <section aria-label="AI engine traffic metrics">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger">
              <KpiCard
                label="AI Sessions"
                value={fmtInt(aiKpis.sessions ?? 0)}
                delta={aiDeltas.sessions ?? null}
                tooltip="Sessions from AI answer engines (Australian traffic)."
              />
              <KpiCard
                label="Share of All Sessions"
                value={fmtPct(aiKpis.shareOfSessions ?? 0)}
                tooltip="AI-engine sessions as a share of all GA4 sessions this window."
              />
              <KpiCard
                label="Conversions"
                value={fmtInt(aiKpis.conversions ?? 0)}
                delta={aiDeltas.conversions ?? null}
                tooltip="GA4 key events from AI-engine sessions."
              />
              <KpiCard
                label="Revenue"
                value={fmtCurrency(aiKpis.revenue ?? 0)}
                delta={aiDeltas.revenue ?? null}
                tooltip="Online revenue attributed to AI-engine sessions."
              />
            </div>
          </section>

          {(aiTraffic?.daily?.length ?? 0) > 0 && (
            <section className="dash-card p-5" aria-label="Daily AI engine sessions">
              <SectionTitle>Daily AI Engine Sessions</SectionTitle>
              <TrendChart
                data={aiTraffic!.daily!}
                series={{ areas: [{ key: "sessions", color: "var(--gaf-primary)", label: "Sessions", format: fmtCompact }] }}
              />
            </section>
          )}

          <section aria-label="AI engines breakdown">
            <SectionTitle>By AI Engine</SectionTitle>
            <DataTable<Row>
              columns={AI_SOURCE_COLS}
              rows={(aiTraffic?.sources ?? []) as Row[]}
              sortable
            />
          </section>

          <CaveatBanner text="AI-engine traffic is identified by session source (chatgpt.com, perplexity.ai, gemini.google.com, copilot, claude.ai and similar). Some AI referrals arrive unattributed, so treat this as a floor, not a ceiling." />
        </>
      )}

      {/* --- Top queries --- */}
      {active === "queries" && (
        <section aria-label="Top search queries">
          <SectionTitle>Top Queries (Google Search)</SectionTitle>
          <DataTable<Row>
            columns={QUERY_COLS}
            rows={(seoWin?.topQueries ?? []) as Row[]}
            sortable
          />
        </section>
      )}

      {/* --- Top pages --- */}
      {active === "pages" && (
        <section aria-label="Top pages in search">
          <SectionTitle>Top Pages (Google Search)</SectionTitle>
          <DataTable<Row>
            columns={PAGE_COLS}
            rows={(seoWin?.topPages ?? []) as Row[]}
            sortable
          />
        </section>
      )}
    </div>
  );
}
