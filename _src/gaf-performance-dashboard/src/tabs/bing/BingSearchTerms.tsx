// src/tabs/bing/BingSearchTerms.tsx
import { DataTable } from "../../components/DataTable";
import { fmtCpc, fmtCurrency, fmtInt, fmtPct } from "../../lib/format";
import { CompareToggle } from "../../components/CompareToggle";
import { useCompare } from "../../state/CompareContext";

type Row = Record<string, unknown>;

const COLUMNS = [
  {
    key: "searchTerm" as const, label: "Search Term", align: "left" as const, isName: true,
    sub: (row: Row) => String(row.campaign ?? ""),
  },
  { key: "spend" as const, label: "Spend", align: "right" as const, format: (v: unknown) => fmtCurrency(Number(v ?? 0)) },
  { key: "impressions" as const, label: "Impr.", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "clicks" as const, label: "Clicks", align: "right" as const, format: (v: unknown) => fmtInt(Number(v ?? 0)) },
  { key: "ctr" as const, label: "CTR", align: "right" as const, format: (v: unknown) => fmtPct(Number(v ?? 0)) },
  { key: "avgCpc" as const, label: "CPC", align: "right" as const, format: (v: unknown) => fmtCpc(Number(v ?? 0)), invert: true },
] satisfies { key: keyof Row & string; label: string; align: "left" | "right"; format?: (v: unknown) => string; isName?: boolean; tooltip?: string; sub?: (row: Row) => string; invert?: boolean }[];

interface Props {
  bingWin: Record<string, any>;
}

export function BingSearchTerms({ bingWin }: Props) {
  const { compare } = useCompare();
  const searchTerms = (bingWin.searchTerms ?? []) as Row[];

  return (
    <div className="space-y-4 fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Search Terms
        </h3>
        <CompareToggle />
      </div>
      <DataTable<Row> columns={COLUMNS} rows={searchTerms} sortable compare={compare} />
      <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        Actual queries that triggered your Shopping &amp; Dynamic Search ads. Selected window, top 200 by spend.
      </p>
    </div>
  );
}
