// src/tabs/MarketingExpenses.tsx
// Marketing Expenses: category pie + grouped line-item table, driven by the
// global window. Data source: the "EXPENSES ARRAY" sheet tab (published CSV),
// pulled server-side by sources/expenses.py.
//
// The "Exclude ad spend" toggle (default ON) drops rows flagged mediaSpend —
// that paid-channel spend is already shown in full on the Meta/Google tabs,
// and left in it swamps the pie (~96% of every window). Off shows total outlay.
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { DataTable } from "../components/DataTable";
import { DonutChart } from "../components/DonutChart";
import type { DonutSlice } from "../components/DonutChart";
import { CaveatBanner } from "../components/CaveatBanner";
import { SourceLink } from "../components/SourceLink";
import { fmtCurrency, fmtInt } from "../lib/format";
import type { PerfData, ExpenseLineItem } from "../lib/data";

const EXPENSES_SHEET_URL = "https://docs.google.com/spreadsheets/d/1KReaKeXaaS64z9YWQZJbzPCdW86KH7zKVFwURzR-FPs/edit?gid=1824336538#gid=1824336538";

interface Props {
  data: PerfData;
}

// Stable colours for the common categories; unknowns fall back by order.
const CATEGORY_COLORS: Record<string, string> = {
  "PAID ADVERTISING": "#94a3b8",
  "TECH & FEES": "#f26422",
  "EMAIL MARKETING": "#2563eb",
  "COLLABS AND PARTNERSHIPS": "#db2777",
  "AFFILIATE FEES": "#7c3aed",
  SEO: "#059669",
  EXPO: "#d97706",
  "SUPPLIER REIUMBURSED": "#0891b2",
  AFS: "#65a30d",
  "BRANDING & INNOVATION": "#e11d48",
  "FREELANCE DESIGN": "#c026d3",
  NIKE: "#111827",
};
const FALLBACK = ["#f26422", "#2563eb", "#059669", "#db2777", "#7c3aed", "#d97706", "#0891b2", "#65a30d", "#e11d48", "#0d9488"];

function colorFor(category: string, fallbackIdx: number): string {
  return CATEGORY_COLORS[category] ?? FALLBACK[fallbackIdx % FALLBACK.length];
}

type Row = Record<string, unknown>;

const COLS = [
  { key: "name", label: "Vendor / Item", align: "left" as const, isName: true },
  { key: "category", label: "Category", align: "left" as const },
  {
    key: "count",
    label: "Txns",
    align: "right" as const,
    tooltip: "Number of individual transactions grouped into this row over the window.",
    format: (v: unknown) => fmtInt(Number(v ?? 0)),
  },
  {
    key: "amount",
    label: "Amount (Gross)",
    align: "right" as const,
    tooltip: "Sum of gross amount (incl. GST) over the selected window.",
    format: (v: unknown) => fmtCurrency(Number(v ?? 0)),
  },
];

export function MarketingExpenses({ data }: Props) {
  const { window } = useDateRange();
  const [excludeMedia, setExcludeMedia] = useState(true);

  const win = data.expenses?.[window];

  if (!win || (win.lineItems?.length ?? 0) === 0) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No marketing expenses recorded for this window.
        {win?.dataThrough && (
          <div className="mt-1 text-xs">Expense data runs through {win.dataThrough}.</div>
        )}
      </div>
    );
  }

  const allItems = win.lineItems;
  const items = excludeMedia ? allItems.filter((i) => !i.mediaSpend) : allItems;

  const shownTotal = excludeMedia ? win.totalExMedia : win.total;
  const adSpend = win.total - win.totalExMedia;

  // Category pie derived from the (filtered) line items — single source of truth.
  const byCategory = new Map<string, number>();
  for (const it of items) {
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + it.amount);
  }
  const slices: DonutSlice[] = [...byCategory.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({ label, value, color: colorFor(label, i) }));

  const categoryCount = slices.length;
  const topCategory = slices[0]?.label ?? "–";

  return (
    <div className="space-y-6 fade-in">
      {/* Header row: title + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
              Marketing Expenses
            </h2>
            <SourceLink href={EXPENSES_SHEET_URL} title="Source: marketing expenses ledger (Google Sheet)" />
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--gaf-text-muted)" }}>
            {excludeMedia ? "Non-media operating costs" : "Total marketing outlay incl. ad spend"} · gross (incl. GST)
            {win.dataThrough ? ` · data through ${win.dataThrough}` : ""}
          </p>
        </div>

        {/* Exclude ad spend toggle */}
        <button
          onClick={() => setExcludeMedia((v) => !v)}
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          style={{
            background: excludeMedia ? "var(--gaf-primary)" : "var(--gaf-card-bg)",
            color: excludeMedia ? "#fff" : "var(--gaf-text-secondary)",
            border: "1px solid var(--gaf-input-border)",
          }}
          aria-pressed={excludeMedia}
          title="Ad-channel spend (Meta, Google) is already shown in full on those tabs. Excluding it here keeps this pie about your other marketing costs."
        >
          <span
            className="w-8 h-4 rounded-full relative transition-colors shrink-0"
            style={{ background: excludeMedia ? "rgba(255,255,255,.55)" : "var(--gaf-input-border)" }}
          >
            <span
              className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all"
              style={{ left: excludeMedia ? "18px" : "2px" }}
            />
          </span>
          Exclude ad spend
        </button>
      </div>

      {/* KPI cards */}
      <section aria-label="Expense summary">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <KpiCard
            label={excludeMedia ? "Non-Media Expenses" : "Total Expenses"}
            value={fmtCurrency(shownTotal)}
            tooltip="Sum of gross expense amounts for the selected window (incl. GST)."
          />
          <KpiCard
            label="Ad Spend Excluded"
            value={excludeMedia ? fmtCurrency(adSpend) : "—"}
            subLabel={excludeMedia ? "shown on Meta / Google tabs" : "included above"}
            tooltip="Paid ad-channel spend flagged as media in the ledger. Excluded from the view above when the toggle is on to avoid double-counting the channel tabs."
          />
          <KpiCard label="Line Items" value={fmtInt(items.length)} tooltip="Distinct vendors/items after grouping duplicates over the window." />
          <KpiCard label="Top Category" value={topCategory} subLabel={`${categoryCount} categories`} />
        </div>
      </section>

      {/* Pie + legend */}
      <section className="dash-card p-5" aria-label="Expenses by category">
        <h3 className="text-lg font-bold mb-4" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          By Expense Category
        </h3>
        <DonutChart slices={slices} format={fmtCurrency} centerLabel={excludeMedia ? "Non-media" : "Total"} />
      </section>

      {/* Line-item table */}
      <section aria-label="Expense line items">
        <h3 className="text-lg font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Line Items
        </h3>
        <DataTable<Row> columns={COLS} rows={items as unknown as Row[]} sortable />
      </section>

      <CaveatBanner text="Expenses are grouped by vendor and summed over the selected window (gross, incl. GST). The ledger is posted irregularly, so short windows can look sparse. 'Exclude ad spend' hides paid ad-channel spend that already appears in full on the Meta, Google and Axon tabs." />
    </div>
  );
}
