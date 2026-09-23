/**
 * Winnings coverage / zone schedule → public/data/winnings-zones.json
 *
 *   npm run import:zones -- "/path/to/Winnings coverage schedule.xlsx"
 *
 * Needs a Postcode column and a Zone column (optional Suburb). Postcode cells
 * may be ranges ("2000-2234"), or the sheet may use From / To columns.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { parseZoneSchedule } from '../src/lib/zones.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import:zones -- <schedule.xlsx|.csv>');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
let parsed: ReturnType<typeof parseZoneSchedule> | null = null;
let sheet = '';
for (const name of wb.SheetNames) {
  try {
    parsed = parseZoneSchedule(XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true, defval: null }));
    sheet = name;
    break;
  } catch {}
}
if (!parsed) {
  console.error('No sheet has both a Postcode and a Zone column.');
  process.exit(1);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'winnings-zones.json');
writeFileSync(out, JSON.stringify({ source: `${basename(file)} · sheet "${sheet}"`, updated: new Date().toISOString(), zones: parsed.zones }) + '\n');
const values = Object.values(parsed.zones);
console.log(`Rows used: ${parsed.rows}, skipped: ${parsed.skipped}`);
console.log(`Entries: ${values.length} (${[1, 2, 3, 4, 5].map((z) => `zone ${z}: ${values.filter((v) => v === z).length}`).join(', ')})`);
console.log(`Wrote ${out}`);
