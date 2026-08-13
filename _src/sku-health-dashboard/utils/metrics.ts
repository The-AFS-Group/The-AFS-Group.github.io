import type { Sku, StockStatus } from '../types';
import { STATUS_ORDER } from '../constants';

export const fmtMoney = (n: number, dp = 0) =>
  (n < 0 ? '-' : '') +
  '$' +
  Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}$${abs.toFixed(0)}`;
};

export const fmtNum = (n: number, dp = 0) =>
  n.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtPct = (n: number | null, dp = 1) =>
  n === null || Number.isNaN(n) ? '—' : `${n.toFixed(dp)}%`;

export const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

/** Weighted GP% across a set of lines — a straight average over-weights tiny SKUs. */
export const weightedGp = (rows: Sku[]) => {
  const withGp = rows.filter((r) => r.gp !== null && r.revYTD > 0);
  const rev = withGp.reduce((s, r) => s + r.revYTD, 0);
  if (!rev) return null;
  return withGp.reduce((s, r) => s + r.revYTD * (r.gp as number), 0) / rev;
};

export const sum = <T,>(rows: T[], pick: (r: T) => number) =>
  rows.reduce((s, r) => s + pick(r), 0);

/** Revenue this line earns in an average week, from year-to-date actuals. */
export const weeklyRev = (s: Sku, weeksElapsed: number) =>
  weeksElapsed > 0 ? s.revYTD / weeksElapsed : 0;

export interface Totals {
  skus: number;
  selling: number;
  revYTD: number;
  revMTD: number;
  unitsYTD: number;
  unitsMTD: number;
  gp: number | null;
  onHand: number;
  onOrder: number;
  available: number;
  committed: number;
  backOrdered: number;
  stockouts: number;
  revAtRisk: number;
  deadCapitalUnits: number;
  deadCapitalSkus: number;
  availabilityRate: number;
}

export const totals = (rows: Sku[], weeksElapsed: number): Totals => {
  const selling = rows.filter((r) => r.ros > 0 || r.unitsYTD > 0);
  const stockouts = rows.filter((r) => r.status === 'Stockout');
  const dead = rows.filter((r) => r.status === 'Dead Stock');
  return {
    skus: rows.length,
    selling: selling.length,
    revYTD: sum(rows, (r) => r.revYTD),
    revMTD: sum(rows, (r) => r.revMTD),
    unitsYTD: sum(rows, (r) => r.unitsYTD),
    unitsMTD: sum(rows, (r) => r.unitsMTD),
    gp: weightedGp(rows),
    onHand: sum(rows, (r) => r.onHand),
    onOrder: sum(rows, (r) => r.onOrder),
    available: sum(rows, (r) => r.available),
    committed: sum(rows, (r) => r.committed),
    backOrdered: sum(rows, (r) => r.backOrdered),
    stockouts: stockouts.length,
    revAtRisk: sum(stockouts, (r) => weeklyRev(r, weeksElapsed)),
    deadCapitalUnits: sum(dead, (r) => r.onHand),
    deadCapitalSkus: dead.length,
    availabilityRate: selling.length
      ? (selling.filter((r) => r.available > 0).length / selling.length) * 100
      : 0,
  };
};

export const statusCounts = (rows: Sku[]) => {
  const map = new Map<StockStatus, { count: number; revYTD: number; onHand: number }>();
  STATUS_ORDER.forEach((s) => map.set(s, { count: 0, revYTD: 0, onHand: 0 }));
  rows.forEach((r) => {
    const e = map.get(r.status)!;
    e.count += 1;
    e.revYTD += r.revYTD;
    e.onHand += r.onHand;
  });
  return STATUS_ORDER.map((status) => ({ status, ...map.get(status)! }));
};

export const groupBy = <T,>(rows: T[], key: (r: T) => string) => {
  const map = new Map<string, T[]>();
  rows.forEach((r) => {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  });
  return map;
};

/** Revenue + stock roll-up per group, biggest revenue first. */
export const rollup = (rows: Sku[], key: (r: Sku) => string, limit?: number) => {
  const out = [...groupBy(rows, key).entries()].map(([name, rs]) => ({
    name,
    skus: rs.length,
    revYTD: sum(rs, (r) => r.revYTD),
    unitsYTD: sum(rs, (r) => r.unitsYTD),
    onHand: sum(rs, (r) => r.onHand),
    onOrder: sum(rs, (r) => r.onOrder),
    gp: weightedGp(rs),
    stockouts: rs.filter((r) => r.status === 'Stockout').length,
    healthy: rs.filter((r) => r.status === 'Healthy').length,
  }));
  out.sort((a, b) => b.revYTD - a.revYTD);
  return limit ? out.slice(0, limit) : out;
};

/** Inbound purchase orders bucketed by the month they are due to land. */
export const inboundByMonth = (rows: Sku[]) => {
  const map = new Map<string, { units: number; skus: number; pos: Set<string> }>();
  rows
    .filter((r) => r.eta && r.orderQty > 0)
    .forEach((r) => {
      const k = monthKey(r.eta!);
      if (!map.has(k)) map.set(k, { units: 0, skus: 0, pos: new Set() });
      const e = map.get(k)!;
      e.units += r.orderQty;
      e.skus += 1;
      if (r.po) e.pos.add(r.po);
    });
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, label: monthLabel(key), units: v.units, skus: v.skus, pos: v.pos.size }));
};

export const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const body = [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
