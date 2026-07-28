// src/tabs/google/GoogleAdsTable.tsx
import { DataTable } from "../../components/DataTable";
import { fmtCpc, fmtCurrency, fmtInt, fmtPct, fmtRoas } from "../../lib/format";

type Row = Record<string, unknown>;

const COLUMNS = [
  {
    key: "ad" as const, label: "Ad", align: "left" as const, isName: true,
    sub: (row: Row) => [row.campaign, row.adGroup].filter(Boolean).join(" › "),
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

interface Props {
  googleWin: Record<string, any>;
}

export function GoogleAdsTable({ googleWin }: Props) {
  const ads = (googleWin.ads ?? []) as Row[];

  return (
    <div className="space-y-4 fade-in">
      <h3
        className="text-lg font-bold"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        Ad Performance
      </h3>

      <DataTable<Row> columns={COLUMNS} rows={ads} sortable />

      <p className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        All figures reflect the selected window. Top 200 rows by spend.
      </p>
    </div>
  );
}
