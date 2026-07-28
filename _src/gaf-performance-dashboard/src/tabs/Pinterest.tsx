// src/tabs/Pinterest.tsx
// Pinterest Ads. The pipeline source is live but dormant — it lights up the
// nightly after a token lands in ~/.pinterest-env. Until then: connect card.
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { TrendChart } from "../components/TrendChart";
import { CaveatBanner } from "../components/CaveatBanner";
import { fmtCpc, fmtCurrency, fmtCurrencyCompact, fmtInt, fmtPct, fmtRoas } from "../lib/format";
import type { PerfData } from "../lib/data";

interface Props {
  data: PerfData;
}

type Row = Record<string, unknown>;

const CAMPAIGN_COLS = [
  { key: "name",        label: "Campaign",     align: "left"  as const },
  { key: "spend",       label: "Spend",        align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions", label: "Impressions",  align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks",      label: "Clicks",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr",         label: "CTR",          align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "conversions", label: "Conv.",        align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "revenue",     label: "Revenue",      align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas",        label: "ROAS",         align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtRoas(Number(v)) : "–") },
  { key: "cpa",         label: "CPA",          align: "right" as const, format: (v: unknown) => (Number(v ?? 0) > 0 ? fmtCpc(Number(v)) : "–") },
];

export function Pinterest({ data }: Props) {
  const { window } = useDateRange();
  const pinWin = data.pinterest?.[window];

  if (!pinWin || !pinWin.connected) {
    return (
      <div className="space-y-4 fade-in">
        <div className="dash-card p-8 text-center space-y-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="#E60023" />
            <path
              d="M12.4 5.2c-3.6 0-5.9 2.4-5.9 5 0 1.2.5 2.6 1.7 3.1.2.1.4 0 .4-.2l.2-.8c0-.2 0-.3-.1-.5-.4-.5-.7-1.2-.7-2 0-2 1.5-3.9 4.2-3.9 2.3 0 3.9 1.4 3.9 3.4 0 2.5-1.1 4.4-2.7 4.4-.9 0-1.6-.7-1.4-1.6.3-1.1.8-2.3.8-3.1 0-.7-.4-1.3-1.2-1.3-.9 0-1.7 1-1.7 2.3 0 .8.3 1.4.3 1.4l-1.1 4.6c-.3 1.4 0 3.1 0 3.2 0 .1.2.2.3.1.1-.1 1.4-1.8 1.9-3.4l.6-2.4c.3.6 1.2 1.1 2.1 1.1 2.8 0 4.7-2.6 4.7-6 0-2.6-2.2-5-5.6-5Z"
              fill="#fff"
            />
          </svg>
          <p className="text-sm font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
            Pinterest Ads — not connected yet
          </p>
          <p className="text-xs max-w-md mx-auto" style={{ color: "var(--gaf-text-secondary)" }}>
            The pipeline is wired and waiting on API access. Once a Pinterest access token
            (with <span className="font-mono">ads:read</span> scope) is provided, spend, campaign
            performance and daily trends appear here automatically after the next nightly refresh.
          </p>
          <p className="text-[11px]" style={{ color: "var(--gaf-text-muted)" }}>
            Generate a token in Pinterest Business Hub → Apps, then ask Gary to install it.
          </p>
        </div>
      </div>
    );
  }

  const kpis = pinWin.kpis ?? {};
  const deltas = pinWin.deltas ?? {};
  const campaigns = (pinWin.campaigns ?? []) as Row[];
  const daily = pinWin.daily ?? [];
  const hasConv = Number(kpis.conversions ?? 0) > 0;

  return (
    <div className="space-y-6 fade-in">
      <section aria-label="Pinterest key metrics">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 stagger">
          <KpiCard label="Spend"       value={fmtCurrency(kpis.spend ?? 0)}       delta={deltas.spend ?? null} />
          <KpiCard label="Impressions" value={fmtInt(kpis.impressions ?? 0)}      delta={deltas.impressions ?? null} />
          <KpiCard label="Clicks"      value={fmtInt(kpis.clicks ?? 0)}           delta={deltas.clicks ?? null} />
          <KpiCard label="CTR"         value={fmtPct(kpis.ctr ?? 0)}              delta={deltas.ctr ?? null} />
          <KpiCard label="Conversions" value={fmtInt(kpis.conversions ?? 0)}      delta={deltas.conversions ?? null} />
          <KpiCard label="Revenue"     value={fmtCurrency(kpis.revenue ?? 0)}     delta={deltas.revenue ?? null} />
          <KpiCard label="ROAS"        value={hasConv ? fmtRoas(kpis.roas ?? 0) : "–"} delta={hasConv ? deltas.roas ?? null : null} />
          <KpiCard label="CPA"         value={hasConv ? fmtCpc(kpis.cpa ?? 0) : "–"}   delta={hasConv ? deltas.cpa ?? null : null} invertDelta />
        </div>
      </section>

      {daily.length > 0 && (
        <section className="dash-card p-5" aria-label="Daily Pinterest spend">
          <h3 className="text-lg font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
            Daily Spend
          </h3>
          <TrendChart
            data={daily}
            series={{ areas: [{ key: "spend", color: "var(--gaf-primary)", label: "Spend", format: fmtCurrencyCompact }] }}
          />
        </section>
      )}

      <section aria-label="Pinterest campaigns">
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Campaigns
        </h3>
        <DataTable<Row> columns={CAMPAIGN_COLS} rows={campaigns} sortable />
      </section>

      <CaveatBanner text="Many GAF sales close offline via phone or in-store – ROAS figures are directional only." />
    </div>
  );
}
