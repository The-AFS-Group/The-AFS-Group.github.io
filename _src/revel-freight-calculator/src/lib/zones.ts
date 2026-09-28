import type { Destination } from './freight';
import type { Locality, PostcodesFile, State, ZoneScheduleFile } from './types';

type Cell = string | number | boolean | null | undefined;

/**
 * Reads a Winnings coverage / zone schedule. Accepts any sheet or CSV with a
 * postcode column and a zone column, plus an optional suburb column. The
 * postcode cell may hold a single postcode or a range ("2000-2234"), or the
 * sheet may use separate "from" / "to" postcode columns. Zone cells may read
 * "2", "Zone 2", "Z2".
 */
export function parseZoneSchedule(rows: Cell[][]): { zones: Record<string, number>; rows: number; skipped: number } {
  const norm = (v: Cell) => String(v ?? '').toLowerCase().trim();
  const headerIdx = rows.findIndex((r) => (r || []).some((c) => /post\s*code|^pcode$|^pc$/.test(norm(c))) && (r || []).some((c) => /zone/.test(norm(c))));
  if (headerIdx < 0) throw new Error('Could not find a header row with both a Postcode and a Zone column.');
  const h = rows[headerIdx].map(norm);
  const pcCols = h.map((x, i) => (/post\s*code|^pcode$|^pc$/.test(x) ? i : -1)).filter((i) => i >= 0);
  const fromCol = pcCols.find((i) => /from|start|low/.test(h[i]));
  const toCol = pcCols.find((i) => /(^|\s)to(\s|$)|end|high/.test(h[i]));
  const pcCol = pcCols.find((i) => i !== fromCol && i !== toCol) ?? pcCols[0];
  const zoneCol = h.findIndex((x) => /zone/.test(x));
  const suburbCol = h.findIndex((x) => /suburb|locality|town/.test(x));

  const zones: Record<string, number> = {};
  let count = 0;
  let skipped = 0;
  const pad = (n: number) => String(n).padStart(4, '0');

  for (const r of rows.slice(headerIdx + 1)) {
    if (!r || !r.some((c) => String(c ?? '').trim())) continue;
    const zm = String(r[zoneCol] ?? '').match(/\d+/);
    const zone = zm ? Number(zm[0]) : 0;
    let lo: number | null = null;
    let hi: number | null = null;
    if (fromCol !== undefined && toCol !== undefined) {
      lo = parseInt(String(r[fromCol] ?? ''), 10);
      hi = parseInt(String(r[toCol] ?? ''), 10);
    } else {
      const m = String(r[pcCol] ?? '').match(/(\d{3,4})(?:\s*(?:-|–|to)\s*(\d{3,4}))?/i);
      if (m) {
        lo = Number(m[1]);
        hi = m[2] ? Number(m[2]) : lo;
      }
    }
    if (!zone || lo === null || hi === null || Number.isNaN(lo) || Number.isNaN(hi) || hi < lo || hi - lo > 2000) {
      skipped++;
      continue;
    }
    const suburb = suburbCol >= 0 ? String(r[suburbCol] ?? '').trim().toUpperCase() : '';
    for (let pc = lo; pc <= hi; pc++) zones[suburb && lo === hi ? `${pad(pc)}|${suburb}` : pad(pc)] = zone;
    count++;
  }
  if (!count) throw new Error('No rows with both a postcode and a numeric zone were found.');
  return { zones, rows: count, skipped };
}

export interface PostcodeMatch {
  postcode: string;
  state: State;
  localities: { name: string; zone: number; deliverable: boolean; state: State }[];
}

/** Four digits, or three for NT postcodes written without the leading 0 ("800" → "0800"). */
export function normalisePostcode(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 4) return digits;
  if (digits.length === 3 && /^[89]/.test(digits)) return `0${digits}`;
  return null;
}

export function lookupPostcode(input: string, file: PostcodesFile): PostcodeMatch | null {
  const pc = normalisePostcode(input);
  if (!pc) return null;
  const entry = file.postcodes[pc];
  if (!entry) return null;
  return {
    postcode: pc,
    state: entry.s,
    localities: entry.l.map((l: Locality) => ({ name: l[0], zone: l[1], deliverable: l[2] === 1, state: l[3] ?? entry.s })),
  };
}

/** Schedule entry for this suburb, else for the postcode. */
export function scheduleZone(schedule: ZoneScheduleFile, postcode: string, locality: string): number | null {
  return schedule.zones[`${postcode}|${locality.toUpperCase()}`] ?? schedule.zones[postcode] ?? null;
}

export function buildDestination(match: PostcodeMatch, localityName: string, schedule: ZoneScheduleFile, manualZone: number | null): Destination {
  const loc = match.localities.find((l) => l.name === localityName) ?? match.localities[0];
  const official = scheduleZone(schedule, match.postcode, loc.name);
  const zone = manualZone ?? official ?? loc.zone;
  return {
    postcode: match.postcode,
    locality: loc.name,
    state: loc.state,
    zone,
    zoneSource: manualZone ? 'manual' : official ? 'schedule' : 'estimate',
    deliverable: loc.deliverable,
  };
}

/** Zones present across a postcode's deliverable suburbs, so the UI can say "this postcode spans zones 2-3". */
export function zoneSpread(match: PostcodeMatch, schedule: ZoneScheduleFile): number[] {
  const zs = new Set(match.localities.filter((l) => l.deliverable).map((l) => scheduleZone(schedule, match.postcode, l.name) ?? l.zone));
  return [...zs].filter(Boolean).sort();
}
