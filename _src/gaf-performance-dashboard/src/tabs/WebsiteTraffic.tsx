// src/tabs/WebsiteTraffic.tsx
// GA4 tab with sub-tab navigation (same pattern as the Meta/Google tabs) —
// the single long scroll was poor UX per Josh's 11 Jul review.
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { TrendChart } from "../components/TrendChart";
import { AustraliaMap } from "../components/AustraliaMap";
import { fmtCompact, fmtInt, fmtPct, fmtCurrency } from "../lib/format";
import type { PerfData } from "../lib/data";

interface WebsiteTrafficProps {
  data: PerfData;
}

// ---- Column definitions ----

type ChannelRow = Record<string, unknown>;
type PageRow = Record<string, unknown>;
type ProductRow = Record<string, unknown>;

const CHANNEL_COLS = [
  { key: "channel",     label: "Source / Channel", align: "left"  as const },
  { key: "sessions",    label: "Sessions",          align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "conversions", label: "Conversions",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
];

const PAGE_COLS = [
  { key: "path",               label: "Page",           align: "left"  as const },
  { key: "sessions",           label: "Sessions",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "views",              label: "Page Views",     align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "avgEngagementTime",  label: "Avg. Time (s)",  align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  // Feed sends bounceRate as a FRACTION (0.0683) — display as 6.8%, not 0.1%
  { key: "bounceRate",         label: "Bounce Rate",    align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0) * 100) },
];

const PRODUCT_COLS = [
  { key: "title",    label: "Product",       align: "left"  as const },
  { key: "sessions", label: "Sessions",      align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "atc",      label: "Add-to-Carts",  align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "orders",   label: "Orders",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "revenue",  label: "Revenue",       align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  // null CVR = GA4 has no session data for the page — show a dash, not 0.0%
  { key: "cvr",      label: "CVR",           align: "right" as const, format: (v: unknown) => (v == null ? "–" : `${Number(v).toFixed(1)}%`) },
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

// Shopify bag mark — the funnel's orders/revenue come from Shopify.
function ShopifyMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="inline-block align-[-2px]">
      <path
        d="M14.5 3.2c-.4-.3-.9-.5-1.4-.4 0 0-.3.1-.7.2C11.9 1.9 11.1 1 9.9 1 7.7 1 6.6 3.8 6.3 5.2l-1.9.6c-.6.2-.6.2-.7.8L2 19.6 13.6 22l6.4-1.4S15 3.6 14.9 3.5c0-.2-.2-.3-.4-.3zM12 3.4l-1.6.5c.3-1 .8-2 1.6-2.2v1.7zm-2.1-1.3c.2 0 .3 0 .5.1-.9.5-1.4 1.6-1.7 2.2l-1.3.4c.4-1.2 1.2-2.7 2.5-2.7z"
        fill="#95BF47"
      />
      <path d="M14.9 3.5c-.1 0-1.3-.1-1.3-.1s-.9-.9-1-1v19.5l6.4-1.4S15 3.6 14.9 3.5z" fill="#5E8E3E" />
      <path
        d="M11.6 8.5l-.8 2.4s-.7-.4-1.6-.4c-1.3 0-1.4.8-1.4 1 0 1.1 2.9 1.5 2.9 4.1 0 2-1.3 3.3-3 3.3-2.1 0-3.1-1.3-3.1-1.3l.6-1.8s1.1.9 2 .9c.6 0 .8-.5.8-.8 0-1.4-2.4-1.5-2.4-3.9 0-2 1.4-3.9 4.3-3.9 1.1 0 1.7.4 1.7.4z"
        fill="#fff"
      />
    </svg>
  );
}

// ---- Sub-tab shell ----

type SubTab = "overview" | "pages" | "geo" | "products";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pages",    label: "Top Pages" },
  { key: "geo",      label: "Geography" },
  { key: "products", label: "Products" },
];

export function WebsiteTraffic({ data }: WebsiteTrafficProps) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("overview");

  const ga4Win = data.ga4?.[window];
  const products = (data.products?.[window] ?? []) as unknown as ProductRow[];

  if (!ga4Win) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No website traffic data available for this window.
      </div>
    );
  }

  const { kpis, deltas = {}, channels = [], topPages = [], geo: geoRaw = [], daily = [] } = ga4Win;
  const geo = geoRaw as unknown as Array<{ region: string; sessions: number }>;

  const channelRows = (Array.isArray(channels) ? channels : Object.values(channels)) as ChannelRow[];
  const pageRows = topPages as PageRow[];
  const hasDailyData = Array.isArray(daily) && daily.length > 0;

  // Format avg engagement time: seconds -> "1m 23s" style for KPI display
  const avgEngSec = kpis?.avgEngagementTime ?? 0;
  const engTimeLabel =
    avgEngSec >= 60
      ? `${Math.floor(avgEngSec / 60)}m ${Math.round(avgEngSec % 60)}s`
      : `${Math.round(avgEngSec)}s`;

  return (
    <div className="space-y-6 fade-in">
      {/* Sub-tab pill nav */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="Website traffic sections"
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

      {/* --- Overview: KPIs + daily sessions + channels --- */}
      {active === "overview" && (
        <>
          <section aria-label="Website traffic key metrics">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
              <KpiCard
                label="Sessions"
                value={fmtInt(kpis?.sessions ?? 0)}
                delta={deltas.sessions ?? null}
                tooltip="GA4 sessions in the selected window (Australian traffic only)."
              />
              <KpiCard
                label="Active Users"
                value={fmtInt(kpis?.activeUsers ?? 0)}
                delta={deltas.activeUsers ?? null}
                tooltip="Users with an engaged session."
              />
              <KpiCard
                label="New Users"
                value={fmtInt(kpis?.newUsers ?? 0)}
                delta={deltas.newUsers ?? null}
                tooltip="First-time visitors."
              />
              <KpiCard
                label="Engagement Rate"
                value={fmtPct((kpis?.engagementRate ?? 0) * 100)}
                delta={deltas.engagementRate ?? null}
                tooltip="Engaged sessions ÷ total sessions."
              />
              <KpiCard
                label="Avg. Engagement"
                value={engTimeLabel}
                delta={deltas.avgEngagementTime ?? null}
                tooltip="Average session duration."
              />
              <KpiCard
                label="Conversions"
                value={fmtInt(kpis?.conversions ?? 0)}
                delta={deltas.conversions ?? null}
                tooltip="GA4 key events (conversions) in the window."
              />
            </div>
          </section>

          {hasDailyData && (
            <section className="dash-card p-5" aria-label="Daily sessions trend">
              <SectionTitle>Daily Sessions</SectionTitle>
              <TrendChart
                data={daily}
                series={{
                  areas: [{ key: "sessions", color: "var(--gaf-primary)", label: "Sessions", format: fmtCompact }],
                }}
              />
            </section>
          )}

          <section aria-label="Traffic channels">
            <SectionTitle>Source / Channel</SectionTitle>
            <DataTable<ChannelRow>
              columns={CHANNEL_COLS}
              rows={channelRows}
              sortable
            />
          </section>
        </>
      )}

      {/* --- Top Pages --- */}
      {active === "pages" && (
        <section aria-label="Top pages">
          <SectionTitle>Top Pages</SectionTitle>
          <DataTable<PageRow>
            columns={PAGE_COLS}
            rows={pageRows}
            sortable
          />
        </section>
      )}

      {/* --- Geography --- */}
      {active === "geo" && (
        <section className="dash-card p-5" aria-label="Sessions by Australian state">
          <SectionTitle>Sessions by State</SectionTitle>
          <AustraliaMap geo={geo} />
        </section>
      )}

      {/* --- Products funnel --- */}
      {active === "products" && (
        <section aria-label="Top products funnel">
          <SectionTitle><ShopifyMark /> Top Products (Sessions &rarr; ATC &rarr; Orders)</SectionTitle>
          <DataTable<ProductRow>
            columns={PRODUCT_COLS}
            rows={products}
            sortable
          />
          <p className="text-xs mt-2" style={{ color: "var(--gaf-text-muted)" }}>
            Sessions and add-to-carts join from GA4's top pages; a dash means GA4 recorded no page-level data for that product in this window.
          </p>
        </section>
      )}

      <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        All GA4 metrics on this dashboard cover Australian traffic only.
      </p>
    </div>
  );
}
