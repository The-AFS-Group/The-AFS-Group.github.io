/**
 * Approved Installer List → public/data/revel-installation.json
 *
 *   npm run import:installation -- "/path/to/Approved_Installer_List.xlsx"
 *
 * Reads the "REVEL SAUNAS INSTALLATION" tab and keeps only the
 * "Total Charge to customer" block (Install Only, Rubbish removal,
 * Oil & Silicone) per model and size. Installer agreed rates (what we pay)
 * are not written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:installation -- <Approved_Installer_List.xlsx>');
  process.exit(1);
}
const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
const sheet = wb.SheetNames.find((n) => /revel\s*saunas\s*installation/i.test(n));
if (!sheet) throw new Error('No "REVEL SAUNAS INSTALLATION" tab in this workbook.');
const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: null });

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const header = rows.findIndex((r) => r.some((c) => norm(c) === 'product group'));
const h = rows[header].map(norm);
// The customer block is the second set of columns, starting at "Delivery Only" after the first "Total Invoice".
const totalInvoice = h.findIndex((x) => x.startsWith('total invoice'));
const find = (label: RegExp) => h.findIndex((x, i) => i > totalInvoice && label.test(x));
const col = { install: find(/^install only/), rubbish: find(/^rubbish/), oil: find(/^oil/), total: find(/^total charge/) };
if (Object.values(col).some((i) => i < 0)) throw new Error('Could not find the "Total Charge to customer" columns.');

const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

type Rate = { model: string; persons: number | null; install: number | null; rubbish: number | null; oilSilicone: number | null };
const saunas: Rate[] = [];
let iceBath: Omit<Rate, 'model' | 'persons'> | null = null;
let section = '';
let model = '';
for (const r of rows.slice(header + 1)) {
  const a = String(r[0] ?? '').trim();
  const b = String(r[1] ?? '').trim();
  if (a && !b && r.slice(2).every((c) => c === null || c === '')) {
    section = a.toLowerCase();
    continue;
  }
  if (a) model = a;
  const rate = { install: money(r[col.install]), rubbish: money(r[col.rubbish]), oilSilicone: money(r[col.oil]) };
  if (!rate.install && !rate.rubbish && !rate.oilSilicone) continue;
  if (section.startsWith('saunas')) {
    const p = b.match(/(\d+)\s*person/i);
    saunas.push({ model: model.replace(/\s+V\d+\b/i, '').replace(/\s+barrel$/i, '').replace(/\s+cabin$/i, '').trim(), persons: p ? Number(p[1]) : null, ...rate });
  } else if (section.startsWith('ice bath')) {
    iceBath = rate;
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'revel-installation.json');
writeFileSync(
  out,
  JSON.stringify(
    { source: `${basename(file)} · tab "${sheet}" · Total Charge to customer`, importedAt: new Date().toISOString(), saunas, iceBath },
    null,
    2,
  ) + '\n',
);
console.log(`Saunas: ${saunas.length} rows (${[...new Set(saunas.map((s) => s.model))].join(', ')})`);
console.log(`Ice bath: ${JSON.stringify(iceBath)}`);
console.log(`Wrote ${out}`);
