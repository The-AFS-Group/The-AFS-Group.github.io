import type { Carton, Product, ProductStatus } from './types';

/**
 * Turns the "Master Data Succinct" sheet into the products the calculator needs.
 *
 * Columns are found by header text, not position, so inserting or reordering
 * columns in the workbook does not break an import. Only freight-relevant
 * fields are kept: cost, wholesale price and supplier never leave the workbook.
 *
 * Shared by the in-browser upload and scripts/import-master-data.ts.
 */

type Cell = string | number | boolean | null | undefined;

const SERVICE_CATEGORIES = new Set(['BUILDING & CONSTRUCTION SERVICES', 'INSTALL', 'GIFT CARDS']);
const MAX_CARTONS = 20;
/** Flag a carton when its CBM column and its dimensions disagree by more than 10% and 0.005 m³. */
const CBM_TOLERANCE = 0.1;
const CBM_MIN_DIFF = 0.005;

const norm = (h: Cell) => String(h ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Master data uses 0 / "0.0" as a blank placeholder. */
function text(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v === 0 ? '' : String(v);
  const s = String(v).trim();
  return s === '0' || s === '0.0' ? '' : s;
}

function num(v: Cell): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function findHeaderRow(rows: Cell[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if ((rows[i] || []).some((c) => norm(c) === 'item id')) return i;
  }
  return -1;
}

export interface ParseResult {
  products: Product[];
  skipped: number;
}

export function parseMasterData(rows: Cell[][]): ParseResult {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) throw new Error('Could not find an "ITEM ID" header. Is this the Master Data Succinct sheet?');
  const header = rows[headerIdx].map(norm);

  const col = (pred: (h: string) => boolean) => header.findIndex(pred);
  const c = {
    sku: col((h) => h === 'item id'),
    name: col((h) => h === 'description'),
    brand: col((h) => h === 'brand'),
    lifecycle: col((h) => h.startsWith('product life cycle')),
    isGroup: col((h) => h.startsWith('is item group')),
    category: col((h) => h === 'category'),
    subCategory: col((h) => h === 'sub category'),
    rrp: col((h) => h === 'rrp'),
    declared: col((h) => h.startsWith('number of cartons')),
  };
  if (c.sku < 0) throw new Error('Missing ITEM ID column');

  const cartonCols: Record<number, Partial<Record<'code' | 'w' | 'd' | 'h' | 'kg' | 'cbm', number>>> = {};
  header.forEach((h, i) => {
    const m = h.match(/^carton (\d+) (code internal|width \(cm\)|depth \(cm\)|height \(cm\)|weight \(kg\)|cbm)$/);
    if (!m) return;
    const n = Number(m[1]);
    if (n < 1 || n > MAX_CARTONS) return;
    const key = ({ 'code internal': 'code', 'width (cm)': 'w', 'depth (cm)': 'd', 'height (cm)': 'h', 'weight (kg)': 'kg', cbm: 'cbm' } as const)[
      m[2] as 'code internal'
    ];
    (cartonCols[n] ||= {})[key] = i;
  });
  const cartonNums = Object.keys(cartonCols).map(Number).sort((a, b) => a - b);

  const products: Product[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const row of rows.slice(headerIdx + 1)) {
    const sku = text(row[c.sku]);
    if (!sku) {
      if (row.some((v) => text(v))) skipped++;
      continue;
    }
    if (seen.has(sku)) {
      skipped++;
      continue;
    }
    seen.add(sku);

    const get = (i: number) => (i >= 0 ? row[i] : undefined);
    const category = text(get(c.category)).toUpperCase();
    const issues: string[] = [];
    const cartons: Carton[] = [];

    for (const n of cartonNums) {
      const cc = cartonCols[n];
      const w = num(get(cc.w ?? -1));
      const d = num(get(cc.d ?? -1));
      const h = num(get(cc.h ?? -1));
      const recorded = num(get(cc.cbm ?? -1));
      const fromDims = (w * d * h) / 1e6;
      if (recorded <= 0 && fromDims <= 0) continue;
      const diff = Math.abs(recorded - fromDims);
      if (recorded > 0 && fromDims > 0 && diff > CBM_MIN_DIFF && diff / Math.max(recorded, fromDims) > CBM_TOLERANCE) {
        issues.push(`Carton ${n}: CBM column ${recorded.toFixed(3)} m³ but dimensions give ${fromDims.toFixed(3)} m³`);
      }
      cartons.push({
        code: text(get(cc.code ?? -1)) || `Carton ${n}`,
        widthCm: w,
        depthCm: d,
        heightCm: h,
        weightKg: num(get(cc.kg ?? -1)),
        cbm: round(recorded, 6),
      });
    }

    const declared = Math.round(num(get(c.declared)));
    const isService = SERVICE_CATEGORIES.has(category) || /^(winnings )?install/i.test(sku) || sku.toUpperCase() === 'STORAGE';
    let status: ProductStatus = 'ok';
    if (isService) status = 'service';
    else if (!cartons.length) {
      status = 'no-cartons';
      issues.push('No carton dimensions in master data');
    }
    if (!isService && declared > 0 && cartons.length > 0 && cartons.length < declared) {
      issues.push(`Master data says ${declared} cartons but only ${cartons.length} have dimensions`);
    }
    const name = text(get(c.name));
    if (!name) issues.push('No description in master data');

    const rrp = num(get(c.rrp));
    products.push({
      sku,
      name: name || sku,
      brand: text(get(c.brand)),
      category,
      subCategory: text(get(c.subCategory)).toUpperCase(),
      lifecycle: text(get(c.lifecycle)) || 'Unknown',
      isGroup: /^y/i.test(text(get(c.isGroup))),
      rrp: rrp > 0 ? rrp : null,
      declaredCartons: declared,
      cartons,
      status,
      issues,
    });
  }

  return { products, skipped };
}

/** Picks the master data sheet: the one named like it, else the first with an ITEM ID header. */
export function pickSheetName(sheetNames: string[], rowsOf: (name: string) => Cell[][]): string {
  const named = sheetNames.find((n) => /master\s*data/i.test(n) && findHeaderRow(rowsOf(n)) >= 0);
  if (named) return named;
  const any = sheetNames.find((n) => findHeaderRow(rowsOf(n)) >= 0);
  if (!any) throw new Error('No sheet in this workbook has an "ITEM ID" header row.');
  return any;
}

function round(n: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
