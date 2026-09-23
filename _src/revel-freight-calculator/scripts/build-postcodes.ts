/**
 * Australian postcodes → public/data/postcodes.json
 *
 *   npm run build:postcodes                 (downloads the latest CSV)
 *   npm run build:postcodes -- local.csv    (uses a file you already have)
 *
 * Source: community-maintained australian_postcodes.csv
 * (github.com/matthewproctor/australianpostcodes), which carries each
 * locality's ABS Remoteness Area. The estimated Winnings zone is:
 *
 *   Major Cities → 1   Inner Regional → 2   Outer Regional → 3
 *   Remote → 4         Very Remote → 5
 *
 * with Greater Hobart and Greater Darwin set to zone 1, because the ABS
 * classes those capital-city metros as regional. This is only an estimate:
 * an uploaded Winnings coverage schedule (winnings-zones.json) always wins.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import type { Locality, PostcodesFile, State } from '../src/lib/types.ts';

const SOURCE_URL = 'https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv';
const CAPITAL_METRO_SA4 = new Set(['601', '701']); // Hobart, Darwin
const VALID_STATES = new Set(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'NT', 'TAS', 'ACT']);

const csv = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SOURCE_URL)).text();
const wb = XLSX.read(csv, { type: 'string', raw: true });
const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' });

/**
 * ABS Remoteness category 1-5. RA_2016 first: it is complete for all but a
 * handful of localities, whereas RA_2021 is blank for ~1,000 (all of Alice
 * Springs, for one). RA_2021 is state digit + category 0-4.
 */
function remoteness(r: Record<string, string>): number {
  const ra2016 = Number(String(r.RA_2016 || '').trim());
  if (ra2016 >= 1 && ra2016 <= 5) return ra2016;
  const ra2021 = String(r.RA_2021 || '').trim();
  if (/^\d+$/.test(ra2021)) return (Number(ra2021) % 10) + 1;
  const ra2011 = Number(String(r.RA_2011 || '').trim());
  return ra2011 >= 1 && ra2011 <= 5 ? ra2011 : 0;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase()).replace(/\b([OD])'([a-z])/g, (_, a, b) => `${a}'${b.toUpperCase()}`);

type Raw = { name: string; zone: number; deliverable: 0 | 1; state: State };
const byPostcode = new Map<string, Raw[]>();
for (const r of rows) {
  const pc = String(r.postcode || '').trim().padStart(4, '0');
  const state = String(r.state || '').trim().toUpperCase();
  if (!/^\d{4}$/.test(pc) || !VALID_STATES.has(state)) continue;
  const zone = CAPITAL_METRO_SA4.has(String(r.sa4 || '').trim()) ? 1 : remoteness(r);
  const type = String(r.type || '').trim();
  const list = byPostcode.get(pc) || [];
  list.push({ name: titleCase(String(r.locality || '').trim()), zone, deliverable: type === 'Delivery Area' || type === '' ? 1 : 0, state: state as State });
  byPostcode.set(pc, list);
}

const mode = <T,>(xs: T[]): T | undefined => {
  const counts = new Map<T, number>();
  xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const postcodes: PostcodesFile['postcodes'] = {};
for (const pc of [...byPostcode.keys()].sort()) {
  const raw = byPostcode.get(pc)!;
  const primary = mode(raw.filter((x) => x.deliverable).map((x) => x.state)) || mode(raw.map((x) => x.state))!;
  const fallbackZone = mode(raw.filter((x) => x.zone).map((x) => x.zone)) || 0;
  const seen = new Set<string>();
  const l: Locality[] = [];
  for (const x of raw.sort((a, b) => b.deliverable - a.deliverable || a.name.localeCompare(b.name))) {
    const key = `${x.name}|${x.state}`;
    if (!x.name || seen.has(key)) continue;
    seen.add(key);
    const zone = x.zone || fallbackZone;
    l.push(x.state === primary ? [x.name, zone, x.deliverable] : [x.name, zone, x.deliverable, x.state]);
  }
  postcodes[pc] = { s: primary, l };
}

const out: PostcodesFile = {
  source: `australian_postcodes.csv (github.com/matthewproctor/australianpostcodes), built ${new Date().toISOString().slice(0, 10)}`,
  method: 'Estimated zone from ABS Remoteness Area (2016): Major Cities 1, Inner Regional 2, Outer Regional 3, Remote 4, Very Remote 5. Greater Hobart and Greater Darwin set to 1.',
  postcodes,
};
const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'postcodes.json');
writeFileSync(file, JSON.stringify(out) + '\n');
const all = Object.values(postcodes).flatMap((p) => p.l);
console.log(`Postcodes: ${Object.keys(postcodes).length}, localities: ${all.length}, unknown zone: ${all.filter((x) => !x[1]).length}`);
console.log(`Wrote ${file}`);
