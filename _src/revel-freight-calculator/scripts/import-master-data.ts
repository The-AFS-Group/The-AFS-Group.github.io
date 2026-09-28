/**
 * Master data workbook → public/data/products.json
 *
 *   npm run import:master-data -- "/path/to/MasterDataSuccinct.xlsx"
 *
 * Keeps only freight fields (SKU, description, brand, category, lifecycle,
 * RRP and carton dimensions). Cost, wholesale and supplier columns are never
 * written, because the published site is public.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { parseMasterData, pickSheetName } from '../src/lib/masterData.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:master-data -- <MasterData.xlsx>');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
const rowsOf = (name: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
const sheet = pickSheetName(wb.SheetNames, rowsOf);
const { products, skipped } = parseMasterData(rowsOf(sheet));

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'products.json');
let previous: string[] = [];
try {
  previous = JSON.parse(readFileSync(out, 'utf8')).products.map((p: { sku: string }) => p.sku);
} catch {}

const payload = {
  source: `${basename(file)} · sheet "${sheet}"`,
  importedAt: new Date().toISOString(),
  products,
};
writeFileSync(out, JSON.stringify(payload) + '\n');

const skus = new Set(products.map((p) => p.sku));
const added = products.filter((p) => !previous.includes(p.sku)).map((p) => p.sku);
const removed = previous.filter((s) => !skus.has(s));
const count = (s: string) => products.filter((p) => p.status === s).length;
console.log(`Sheet: ${sheet}`);
console.log(`Products: ${products.length} (${count('ok')} with cartons, ${count('no-cartons')} missing cartons, ${count('service')} services)`);
if (skipped) console.log(`Skipped rows (blank or duplicate SKU): ${skipped}`);
if (previous.length) {
  console.log(`New SKUs (${added.length}): ${added.slice(0, 30).join(', ')}${added.length > 30 ? ' …' : ''}`);
  console.log(`Removed SKUs (${removed.length}): ${removed.slice(0, 30).join(', ')}${removed.length > 30 ? ' …' : ''}`);
}
console.log(`Wrote ${out}`);
