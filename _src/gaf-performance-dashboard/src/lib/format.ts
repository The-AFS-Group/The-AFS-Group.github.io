export type DeltaDir = "up" | "down" | "flat";

export interface DeltaResult {
  text: string;
  dir: DeltaDir;
}

const audCurrency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const intFormatter = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format as AUD with no cents: e.g. $1,235 */
export function fmtCurrency(n: number): string {
  // Intl en-AU produces "A$1,235" — strip the leading "A" to get "$1,235"
  return audCurrency.format(Math.round(n)).replace(/^A/, "");
}

const audCurrencyCpc = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format as AUD with 2 decimal places for CPC/cost-per metrics: e.g. $1.65 */
export function fmtCpc(n: number): string {
  return audCurrencyCpc.format(n).replace(/^A/, "");
}

/** Format as an integer with thousands separators: e.g. 12,345 */
export function fmtInt(n: number): string {
  return intFormatter.format(Math.round(n));
}

/** Format as a percentage with 1 decimal place: e.g. 12.3% */
export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Format as ROAS with 2 decimal places: e.g. 3.42x */
export function fmtRoas(n: number): string {
  return `${n.toFixed(2)}x`;
}

/** Compact integer with K/M suffixes above 10K: 9500 -> 9,500, 12345 -> 12.3K, 1200000 -> 1.2M */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return intFormatter.format(Math.round(n));
}

/** Compact AUD with K/M suffixes: 12345 -> $12.3K, 1200000 -> $1.2M */
export function fmtCurrencyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return fmtCurrency(n);
}

/**
 * Format a delta percentage.
 * null/undefined -> { text: "–", dir: "flat" }
 * positive      -> { text: "+12.3%", dir: "up" }
 * negative      -> { text: "-12.3%", dir: "down" }
 * zero          -> { text: "0.0%", dir: "flat" }
 * |n| > 999     -> capped display ">999%" (matches reference dashboards)
 */
export function fmtDelta(n: number | null | undefined): DeltaResult {
  if (n === null || n === undefined) {
    return { text: "–", dir: "flat" };
  }
  if (Math.abs(n) > 999) {
    return { text: ">999%", dir: n > 0 ? "up" : "down" };
  }
  if (n > 0) {
    return { text: `+${fmtPct(n)}`, dir: "up" };
  }
  if (n < 0) {
    return { text: fmtPct(n), dir: "down" };
  }
  return { text: fmtPct(n), dir: "flat" };
}
