// src/tabs/google/GoogleKeywordsSearchTerms.tsx
import { useState } from "react";
import { DataTable } from "../../components/DataTable";
import { fmtCpc, fmtCurrency, fmtInt, fmtPct, fmtRoas } from "../../lib/format";

type Row = Record<string, unknown>;

// Feed: { keyword, matchType, campaign, spend, impressions, clicks, ctr, avgCpc,
//         conversions, convValue, roas, cpa, atc, atcRate, searchImprShare }
const KEYWORD_COLS = [
  {
    key: "keyword" as const, label: "Keyword", align: "left" as const, isName: true,
    sub: (row: Row) => [row.matchType, row.campaign].filter(Boolean).join(" · "),
  },
  { key: "spend" as const, label: "Spend", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions" as const, label: "Impr.", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks" as const, label: "Clicks", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr" as const, label: "CTR", align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "avgCpc" as const, label: "CPC", align: "right" as const, format: (v: unknown) => fmtCpc(Number(v ?? 0)) },
  { key: "conversions" as const, label: "Conv.", align: "right" as const, format: (v: unknown) => Number(v ?? 0).toFixed(1) },
  { key: "convValue" as const, label: "Conv. Value", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas" as const, label: "ROAS", align: "right" as const, format: (v: unknown) => fmtRoas(Number(v ?? 0)) },
  { key: "cpa" as const, label: "CPA", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  {
    key: "searchImprShare" as const,
    label: "Impr. Share",
    align: "right" as const,
    format: (v: unknown) =>
      v == null || v === "" ? "n/a" : fmtPct(Number(v)),
  },
] satisfies { key: keyof Row & string; label: string; align: "left" | "right"; format?: (v: unknown) => string; isName?: boolean; tooltip?: string; sub?: (row: Row) => string }[];

// Feed: { searchTerm, campaign, spend, impressions, clicks, ctr, avgCpc, conversions, convValue, roas, cpa, atc, atcRate }
const SEARCH_TERM_COLS = [
  {
    key: "searchTerm" as const, label: "Search Term", align: "left" as const, isName: true,
    sub: (row: Row) => String(row.campaign ?? ""),
  },
  { key: "spend" as const, label: "Spend", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions" as const, label: "Impr.", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks" as const, label: "Clicks", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr" as const, label: "CTR", align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "avgCpc" as const, label: "CPC", align: "right" as const, format: (v: unknown) => fmtCpc(Number(v ?? 0)) },
  { key: "conversions" as const, label: "Conv.", align: "right" as const, format: (v: unknown) => Number(v ?? 0).toFixed(1) },
  { key: "convValue" as const, label: "Conv. Value", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "roas" as const, label: "ROAS", align: "right" as const, format: (v: unknown) => fmtRoas(Number(v ?? 0)) },
  { key: "cpa" as const, label: "CPA", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
] satisfies { key: keyof Row & string; label: string; align: "left" | "right"; format?: (v: unknown) => string; isName?: boolean; tooltip?: string; sub?: (row: Row) => string }[];

type ViewMode = "keywords" | "searchTerms";

interface Props {
  googleWin: Record<string, any>;
}

export function GoogleKeywordsSearchTerms({ googleWin }: Props) {
  const [view, setView] = useState<ViewMode>("keywords");

  const keywords = (googleWin.keywords ?? []) as Row[];
  const searchTerms = (googleWin.searchTerms ?? []) as Row[];

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3
          className="text-lg font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          {view === "keywords" ? "Keywords" : "Search Terms"}
        </h3>
        {/* View toggle */}
        <div className="inline-flex gap-1 p-1 rounded-lg bg-gray-100">
          {(["keywords", "searchTerms"] as ViewMode[]).map((v) => {
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? "#fff" : "transparent",
                  color: isActive ? "#111827" : "var(--gaf-text-muted)",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}
              >
                {v === "keywords" ? "Keywords" : "Search Terms"}
              </button>
            );
          })}
        </div>
      </div>

      {view === "keywords" ? (
        <DataTable<Row> columns={KEYWORD_COLS} rows={keywords} sortable />
      ) : (
        <DataTable<Row> columns={SEARCH_TERM_COLS} rows={searchTerms} sortable />
      )}

      <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        All figures reflect the selected window. Top 200 rows by spend.
      </p>
    </div>
  );
}
