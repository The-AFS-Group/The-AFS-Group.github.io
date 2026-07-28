// src/tabs/Email.tsx
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { TrendChart } from "../components/TrendChart";
import { fmtCompact, fmtInt, fmtPct } from "../lib/format";
import type { PerfData } from "../lib/data";

interface EmailProps {
  data: PerfData;
}

type SendRow = Record<string, unknown>;

const SENDS_COLS = [
  {
    key: "name", label: "Name", align: "left" as const,
    href: (row: SendRow) => String(row.url ?? ""),
  },
  { key: "sendDate",    label: "Send Date",   align: "left"  as const },
  { key: "sends",       label: "Sends",       align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "delivered",   label: "Delivered",   align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "openRate",    label: "Open Rate",   align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "clickRate",   label: "Click Rate",  align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "unsubRate",   label: "Unsub Rate",  align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "bounceRate",  label: "Bounce Rate", align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
];

export function Email({ data }: EmailProps) {
  const { window } = useDateRange();

  const hubspotWin = data.hubspot?.[window];

  if (!hubspotWin) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No HubSpot email data available for this window.
      </div>
    );
  }

  const kpis  = hubspotWin.kpis  ?? {};
  const sends = ((hubspotWin.sends ?? []) as SendRow[]).slice().sort((a, b) => {
    const da = String(a.sendDate ?? "");
    const db = String(b.sendDate ?? "");
    return db.localeCompare(da);
  });

  return (
    <div className="space-y-6 fade-in">
      {/* KPI row */}
      <section aria-label="Email key metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 stagger">
          <KpiCard
            label="Total Sends"
            value={fmtInt(kpis.totalSends ?? 0)}
            tooltip="Marketing emails sent in the selected window."
          />
          <KpiCard
            label="Avg Open Rate"
            value={fmtPct(kpis.avgOpenRate ?? 0)}
            tooltip="Sends-weighted: total opens ÷ total delivered across all sends in the window."
          />
          <KpiCard
            label="Avg CTR"
            value={fmtPct(kpis.avgCtr ?? 0)}
            tooltip="Sends-weighted: total clicks ÷ total delivered across all sends in the window."
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--gaf-text-muted)" }}>
          Revenue not tracked in HubSpot for this portal. Email names link to HubSpot.
        </p>
      </section>

      {/* Master list size + growth */}
      {hubspotWin.list && (
        <section className="dash-card p-5" aria-label="Master list size">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
            <h3
              className="text-lg font-bold"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              {hubspotWin.list.name ?? "Master List"}
            </h3>
            <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--gaf-primary)", fontFamily: "var(--font-display)" }}>
              {fmtInt(hubspotWin.list.size ?? 0)}
              <span className="text-xs font-normal ml-1.5" style={{ color: "var(--gaf-text-muted)" }}>contacts</span>
              {hubspotWin.list.growth30dPct != null && (
                <span
                  className="text-xs font-semibold ml-2"
                  style={{ color: hubspotWin.list.growth30dPct >= 0 ? "var(--gaf-delta-pos)" : "var(--gaf-delta-neg)" }}
                >
                  {hubspotWin.list.growth30dPct >= 0 ? "+" : ""}{hubspotWin.list.growth30dPct}% (30d)
                </span>
              )}
            </span>
          </div>
          {(hubspotWin.list.history?.length ?? 0) >= 2 ? (
            <TrendChart
              data={(hubspotWin.list.history ?? []) as Array<{ date: string; [k: string]: number | string }>}
              series={{ areas: [{ key: "size", color: "var(--gaf-primary)", label: "List size", format: fmtCompact }] }}
            />
          ) : (
            <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
              Growth chart builds from nightly snapshots starting 11 Jul 2026 — HubSpot does not expose historical list sizes, so the trend accumulates from here.
            </p>
          )}
        </section>
      )}

      {/* Sends table */}
      <section aria-label="Email sends">
        <h3
          className="text-lg font-bold mb-3"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Sends
        </h3>
        <DataTable<SendRow>
          columns={SENDS_COLS}
          rows={sends}
          sortable
        />
      </section>
    </div>
  );
}
