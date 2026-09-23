const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const aud = (n: number) => money.format(n);
export const cbm = (n: number) => `${n < 0.01 ? n.toFixed(4) : n.toFixed(3)} m³`;
export const kg = (n: number) => `${n >= 100 ? Math.round(n) : n.toFixed(1)} kg`;
export const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s/&+-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

export function dateLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
