// src/tabs/GrowthMatrix.tsx
// Growth Matrix: the daily marketing-contribution P&L, replicating Josh's
// Growth Matrix sheet down to (but excluding) Fixed Costs. The pipeline
// recomputes every row from the sheet's own data tabs + Drivers constants
// (sources/growth_matrix.py), so this reconciles with the sheet exactly.
//
// Calendar-month view with its own month picker — deliberately NOT driven by
// the global window selector, because the sheet is a month-tab artefact.
import { useMemo, useState } from "react";
import { KpiCard } from "../components/KpiCard";
import { CaveatBanner } from "../components/CaveatBanner";
import { SourceLink } from "../components/SourceLink";
import { fmtCurrency, fmtCpc, fmtInt, fmtRoas } from "../lib/format";
import type { PerfData, GrowthMatrixDay, GrowthMatrixMonth } from "../lib/data";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RRlMgNqAk-BN3PA8H3ywqSWLUJY-5_yG_EXy-X5JkUw/edit";

interface Props {
  data: PerfData;
}

// ---- Row config -----------------------------------------------------------

type Fmt = "currency" | "cents" | "int" | "pct2" | "roas";

interface RowDef {
  key: string;
  label: string;
  fmt: Fmt;
  /** Additive rows get Month Total sums + a Run Rate projection. */
  additive?: boolean;
  /** Bold subtotal styling. */
  em?: boolean;
  /** Colour value green/red by sign (contribution rows). */
  signed?: boolean;
}

interface SectionDef {
  title: string;
  rows: RowDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Revenue",
    rows: [
      { key: "totalRevenue", label: "Total Revenue", fmt: "currency", additive: true, em: true },
      { key: "inboundRevenue", label: "Inbound Revenue", fmt: "currency", additive: true },
      { key: "outboundRevenue", label: "Outbound Revenue", fmt: "currency", additive: true },
      { key: "revenueExGst", label: "Revenue ex GST", fmt: "currency", additive: true },
    ],
  },
  {
    title: "Sales Performance",
    rows: [
      { key: "inboundOrders", label: "Inbound Orders", fmt: "int", additive: true },
      { key: "inboundConvRate", label: "Inbound Conversion Rate", fmt: "pct2" },
      { key: "inboundRevPct", label: "Inbound Revenue % of Total", fmt: "pct2" },
      { key: "inboundAov", label: "Inbound AOV", fmt: "currency" },
      { key: "outboundOrders", label: "Outbound Orders", fmt: "int", additive: true },
      { key: "outboundAov", label: "Outbound AOV", fmt: "currency" },
      { key: "onlineOrders", label: "Online Orders", fmt: "int", additive: true },
      { key: "onlineRevenue", label: "Online Revenue", fmt: "currency", additive: true },
      { key: "onlineConvRate", label: "Online Conversion Rate", fmt: "pct2" },
      { key: "offlineOrders", label: "Offline Orders (Sales Team)", fmt: "int", additive: true },
      { key: "offlineRevenue", label: "Offline Revenue (Sales Team)", fmt: "currency", additive: true },
      { key: "b2bRevenue", label: "B2B Revenue", fmt: "currency", additive: true },
      { key: "b2cRevenue", label: "B2C Revenue", fmt: "currency", additive: true },
    ],
  },
  {
    title: "Marketing Performance",
    rows: [
      { key: "sessions", label: "Store Sessions", fmt: "int", additive: true },
      { key: "inboundCalls", label: "Inbound Sales Calls", fmt: "int", additive: true },
      { key: "outboundCalls", label: "Outbound Sales Calls", fmt: "int", additive: true },
      { key: "costPerVisit", label: "Cost Per Visit", fmt: "cents" },
      { key: "revenuePerVisit", label: "Revenue Per Visit", fmt: "cents" },
      { key: "gpPerVisit", label: "GP Per Visit", fmt: "cents" },
      { key: "cpa", label: "Cost Per Acquisition", fmt: "currency" },
      { key: "abandonedCarts", label: "Abandoned Carts", fmt: "int", additive: true },
      { key: "abandonedCartValue", label: "Abandoned Cart Value", fmt: "currency", additive: true },
    ],
  },
  {
    title: "Advertising",
    rows: [
      { key: "fbSpend", label: "Facebook Ad Spend", fmt: "currency", additive: true },
      { key: "googleSpend", label: "Google Ad Spend", fmt: "currency", additive: true },
      { key: "tiktokSpend", label: "TikTok Ad Spend", fmt: "currency", additive: true },
      { key: "agencyFee", label: "Agency Fee (8%)", fmt: "currency", additive: true },
      { key: "giveaways", label: "Product Giveaways", fmt: "currency", additive: true },
      { key: "fixedAdvertising", label: "Fixed Advertising Expenses", fmt: "currency", additive: true },
      { key: "totalAdvertising", label: "Total Advertising", fmt: "currency", additive: true, em: true },
      { key: "totalMer", label: "Total MER", fmt: "pct2", em: true },
      { key: "paidSpendMer", label: "Paid Spend MER", fmt: "pct2" },
      { key: "sitewideRoas", label: "Sitewide ROAS", fmt: "roas" },
    ],
  },
  {
    title: "Variable COGS & Fulfilment",
    rows: [
      { key: "inProductCost", label: "Inbound · Product Cost", fmt: "currency", additive: true },
      { key: "inShipping", label: "Inbound · Shipping", fmt: "currency", additive: true },
      { key: "inPickPack", label: "Inbound · Pick Pack (3PL)", fmt: "currency", additive: true },
      { key: "inTransaction", label: "Inbound · Transaction Fees", fmt: "currency", additive: true },
      { key: "inMerchant", label: "Inbound · Merchant Fees", fmt: "currency", additive: true },
      { key: "outProductCost", label: "Outbound · Product Cost", fmt: "currency", additive: true },
      { key: "outShipping", label: "Outbound · Shipping", fmt: "currency", additive: true },
      { key: "outPickPack", label: "Outbound · Pick Pack (3PL)", fmt: "currency", additive: true },
      { key: "outTransaction", label: "Outbound · Transaction Fees", fmt: "currency", additive: true },
      { key: "outMerchant", label: "Outbound · Merchant Fees", fmt: "currency", additive: true },
      { key: "totalVariableCosts", label: "Total Variable Costs", fmt: "currency", additive: true, em: true },
      { key: "vcr", label: "VCR (Variable Cost Ratio)", fmt: "pct2", em: true },
    ],
  },
  {
    title: "Contribution (before fixed costs)",
    rows: [
      { key: "contributionProfit", label: "Contribution Profit", fmt: "currency", additive: true, em: true, signed: true },
      { key: "contributionMarginPct", label: "Contribution Margin", fmt: "pct2", em: true, signed: true },
    ],
  },
];

function fmtValue(v: number | null | undefined, fmt: Fmt): string {
  if (v === null || v === undefined) return "–";
  switch (fmt) {
    case "currency": return fmtCurrency(v);
    case "cents": return fmtCpc(v);
    case "int": return fmtInt(v);
    case "pct2": return `${(v * 100).toFixed(2)}%`;
    case "roas": return fmtRoas(v);
  }
}

function num(day: GrowthMatrixDay, key: string): number | null {
  const v = day[key];
  return typeof v === "number" ? v : null;
}

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ---- Component -------------------------------------------------------------

export function GrowthMatrix({ data }: Props) {
  const gm = data.growthMatrix;
  const months = gm?.months ?? [];
  const [monthKey, setMonthKey] = useState<string>(months[months.length - 1]?.key ?? "");
  const month: GrowthMatrixMonth | undefined = useMemo(
    () => months.find((m) => m.key === monthKey) ?? months[months.length - 1],
    [months, monthKey]
  );

  if (!gm || !month) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        Growth Matrix data isn't in this snapshot yet — it lands with the next nightly pull.
      </div>
    );
  }

  const t = month.totals;
  const partial = month.daysElapsed < month.daysInMonth;
  const noteDates = Object.keys(month.notes ?? {}).sort();

  return (
    <div className="space-y-6 fade-in">
      {/* Header: title + month picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
              Growth Matrix
            </h2>
            <SourceLink href={SHEET_URL} title="Source: The Growth Matrix sheet (recomputed nightly from its data tabs)" />
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--gaf-text-muted)" }}>
            Daily marketing-contribution P&L · everything above fixed costs
            {gm.dataThrough ? ` · data through ${gm.dataThrough}` : ""}
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs" style={{ color: "var(--gaf-text-secondary)" }}>
          Month
          <select
            value={month.key}
            onChange={(e) => setMonthKey(e.target.value)}
            className="text-xs rounded-md px-2 py-1.5 focus:outline-none"
            style={{
              background: "var(--gaf-card-bg)",
              border: "1px solid var(--gaf-input-border)",
              color: "var(--gaf-text-primary)",
            }}
            aria-label="Select month"
          >
            {[...months].reverse().map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* KPI cards: the month at a glance */}
      <section aria-label="Month summary">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <KpiCard
            label="Revenue"
            value={fmtCurrency(t.totalRevenue ?? 0)}
            subLabel={partial ? `run rate ${fmtCurrency(month.runRate.totalRevenue ?? 0)}` : "complete month"}
            tooltip="Sum of TOTAL REVENUE (inc GST) for the month to date. Run rate projects the to-date pace across the full month, matching the sheet's Run Rate column."
          />
          <KpiCard
            label="Contribution Profit"
            value={fmtCurrency(t.contributionProfit ?? 0)}
            subLabel={
              t.contributionMarginPct != null
                ? `${((t.contributionMarginPct as number) * 100).toFixed(2)}% margin`
                : undefined
            }
            tooltip="Revenue ex GST minus total advertising minus total variable costs — the sheet's PROFIT row with fixed costs added back, since this view deliberately stops above fixed costs."
          />
          <KpiCard
            label="Total MER"
            value={t.totalMer != null ? `${((t.totalMer as number) * 100).toFixed(2)}%` : "–"}
            subLabel={t.paidSpendMer != null ? `paid-spend MER ${((t.paidSpendMer as number) * 100).toFixed(2)}%` : undefined}
            tooltip="Total advertising (incl. the 8% agency fee on Facebook + Google) ÷ total revenue. Paid Spend MER = (Facebook + Google) ÷ inbound revenue. Definitions mirror the sheet, so this tab reconciles with it — the Overview's blended MER uses NetSuite revenue and different numerator rules."
          />
          <KpiCard
            label="Variable Cost Ratio"
            value={t.vcr != null ? `${((t.vcr as number) * 100).toFixed(2)}%` : "–"}
            subLabel={`advertising ${fmtCurrency(t.totalAdvertising ?? 0)}`}
            tooltip="Total variable costs (product, shipping, pick-pack, transaction and merchant fees) ÷ total revenue."
          />
        </div>
      </section>

      {/* The matrix itself */}
      <section className="dash-card p-0 overflow-hidden" aria-label="Daily P&L matrix">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 text-left px-3 py-2 font-semibold whitespace-nowrap"
                  style={{ background: "var(--gaf-card-bg)", color: "var(--gaf-text-secondary)", borderBottom: "1px solid var(--gaf-row-border)", minWidth: 210 }}
                >
                  {month.label}
                </th>
                {month.days.map((d) => {
                  const day = new Date(d.date + "T00:00:00");
                  const note = month.notes?.[d.date];
                  return (
                    <th
                      key={d.date}
                      className="px-2 py-2 text-right font-semibold whitespace-nowrap"
                      style={{
                        color: d.hasData ? "var(--gaf-text-secondary)" : "var(--gaf-text-muted)",
                        borderBottom: "1px solid var(--gaf-row-border)",
                        minWidth: 78,
                        opacity: d.hasData ? 1 : 0.55,
                      }}
                      title={note ? `${d.date}: ${note}` : d.date}
                    >
                      <span className="block leading-tight">{day.getDate()}</span>
                      <span className="block leading-tight font-normal" style={{ color: "var(--gaf-text-muted)" }}>
                        {WEEKDAY[day.getDay()]}
                        {note && <span aria-label="has note" style={{ color: "var(--gaf-primary)" }}> ●</span>}
                      </span>
                    </th>
                  );
                })}
                <th
                  className="px-3 py-2 text-right font-bold whitespace-nowrap"
                  style={{ color: "var(--gaf-text-primary)", borderBottom: "1px solid var(--gaf-row-border)", borderLeft: "2px solid var(--gaf-row-border)", minWidth: 100 }}
                >
                  Month Total
                </th>
                {partial && (
                  <th
                    className="px-3 py-2 text-right font-bold whitespace-nowrap"
                    style={{ color: "var(--gaf-text-primary)", borderBottom: "1px solid var(--gaf-row-border)", minWidth: 100 }}
                    title={`Month total ÷ ${month.daysElapsed} days elapsed × ${month.daysInMonth} days`}
                  >
                    Run Rate
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => (
                <SectionRows key={section.title} section={section} month={month} partial={partial} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes legend */}
      {noteDates.length > 0 && (
        <section className="dash-card p-4" aria-label="Month notes">
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
            Notes
          </h3>
          <ul className="space-y-1 text-xs" style={{ color: "var(--gaf-text-secondary)" }}>
            {noteDates.map((d) => (
              <li key={d}>
                <span className="font-semibold" style={{ color: "var(--gaf-primary)" }}>{d}</span> — {month.notes[d]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <CaveatBanner text="Recomputed nightly from the Growth Matrix sheet's own data tabs (NetSuite pivots, GA sessions, ad-cost dumps, expense pivots) plus the Drivers constants, using the sheet's formulas — so figures reconcile with the sheet exactly. Fixed costs are deliberately excluded: the bottom line here is contribution profit, not net profit. Ad-spend and expense feeds lag up to a few days, so the most recent columns can understate costs." />
    </div>
  );
}

// ---- Table rows -------------------------------------------------------------

function SectionRows({ section, month, partial }: { section: SectionDef; month: GrowthMatrixMonth; partial: boolean }) {
  const colCount = 1 + month.days.length + 1 + (partial ? 1 : 0);
  return (
    <>
      <tr>
        <td
          colSpan={colCount}
          className="sticky left-0 px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--gaf-primary)", background: "var(--gaf-card-bg)" }}
        >
          {section.title}
        </td>
      </tr>
      {section.rows.map((row) => (
        <tr key={row.key}>
          <td
            className="sticky left-0 z-10 px-3 py-1.5 whitespace-nowrap"
            style={{
              background: "var(--gaf-card-bg)",
              color: row.em ? "var(--gaf-text-primary)" : "var(--gaf-text-secondary)",
              fontWeight: row.em ? 700 : 400,
              borderBottom: "1px solid var(--gaf-row-border)",
            }}
          >
            {row.label}
          </td>
          {month.days.map((d) => {
            const v = d.hasData ? num(d, row.key) : null;
            const negative = row.signed && v !== null && v < 0;
            const positive = row.signed && v !== null && v > 0;
            return (
              <td
                key={d.date}
                className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums"
                style={{
                  color: negative ? "#dc2626" : positive ? "#16a34a" : row.em ? "var(--gaf-text-primary)" : "var(--gaf-text-secondary)",
                  fontWeight: row.em ? 600 : 400,
                  borderBottom: "1px solid var(--gaf-row-border)",
                  opacity: d.hasData ? 1 : 0.45,
                }}
              >
                {d.hasData ? fmtValue(v, row.fmt) : "–"}
              </td>
            );
          })}
          <MonthCell value={month.totals[row.key]} row={row} borderLeft />
          {partial && (
            <MonthCell value={row.additive ? month.runRate[row.key] : null} row={row} />
          )}
        </tr>
      ))}
    </>
  );
}

function MonthCell({ value, row, borderLeft }: { value: number | null | undefined; row: RowDef; borderLeft?: boolean }) {
  const negative = row.signed && value != null && value < 0;
  const positive = row.signed && value != null && value > 0;
  return (
    <td
      className="px-3 py-1.5 text-right whitespace-nowrap tabular-nums font-semibold"
      style={{
        color: negative ? "#dc2626" : positive ? "#16a34a" : "var(--gaf-text-primary)",
        borderBottom: "1px solid var(--gaf-row-border)",
        ...(borderLeft ? { borderLeft: "2px solid var(--gaf-row-border)" } : {}),
      }}
    >
      {value != null ? fmtValue(value, row.fmt) : "–"}
    </td>
  );
}
