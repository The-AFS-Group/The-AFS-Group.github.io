import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, fuelLevyFromPrices, quote, type Destination, type QuoteOptions } from './freight.ts';
import { parseMasterData } from './masterData.ts';
import type { Carton, Product, RateCard } from './types.ts';

const baseCard: RateCard = JSON.parse(readFileSync(new URL('../../public/data/winnings-rate-card.json', import.meta.url), 'utf8'));
const card = (over: Partial<RateCard['rules']> = {}, fuelPct = 4): RateCard => ({
  ...baseCard,
  fuelLevy: { ...baseCard.fuelLevy, pct: fuelPct },
  rules: { ...baseCard.rules, ...over },
});

const carton = (cbm: number, kg = 10, code = 'C'): Carton => ({ code, widthCm: 0, depthCm: 0, heightCm: 0, weightKg: kg, cbm });
const product = (cartons: Carton[], category = 'ACCESSORIES', sku = 'SKU'): Product => ({
  sku,
  name: sku,
  brand: 'Revel',
  category,
  subCategory: '',
  lifecycle: 'Current',
  isGroup: false,
  rrp: null,
  declaredCartons: cartons.length,
  cartons,
  status: cartons.length ? 'ok' : 'no-cartons',
  issues: [],
});
const dest = (state: Destination['state'], zone = 1): Destination => ({ postcode: '2000', locality: 'Sydney', state, zone, zoneSource: 'schedule', deliverable: true });
const opts = (o: Partial<QuoteOptions> = {}): QuoteOptions => ({ origin: 'NSW', service: 'delivery', install: false, ...o });
const line = (p: Product, qty = 1) => ({ id: p.sku, product: p, qty });

test('size class boundaries match the rate card footnotes (0.13 / 0.35 / 2.0 m³)', () => {
  const c = card();
  const cls = (cbm: number) => classify(cbm * c.cubicFactor, c).id;
  assert.equal(cls(0.1299), 'small');
  assert.equal(cls(0.13), 'medium');
  assert.equal(cls(0.3499), 'medium');
  assert.equal(cls(0.35), 'large');
  assert.equal(cls(1.9999), 'large');
  assert.equal(cls(2.0), 'oversized');
});

test('single small item, metro, same state: minimum charge plus fuel levy and GST', () => {
  const r = quote([line(product([carton(0.05)]))], dest('NSW'), opts(), card());
  assert.equal(r.lastMile, 25);
  assert.equal(r.zone?.amount, 0);
  assert.equal(r.middleMile, null);
  assert.equal(r.fuelLevy.amount, 1);
  assert.equal(r.exGst, 26);
  assert.equal(r.gst, 2.6);
  assert.equal(r.incGst, 28.6);
});

test('per-carton basis: largest carton at minimum, the rest at additional-item rates', () => {
  // Tampere 2P shape: three large cartons and one small.
  const p = product([carton(0.5), carton(0.45), carton(0.6), carton(0.02)], 'SAUNA');
  const r = quote([line(p)], dest('NSW'), opts(), card({}, 0));
  assert.equal(r.lastMile, 100 + 25 + 25 + 6);
  assert.equal(r.items[0].role, 'first');
  assert.equal(r.items[0].cbm, 0.6);
});

test('per-product basis: one item sized on total CBM; extra units at the additional rate', () => {
  const p = product([carton(0.5), carton(0.45), carton(0.6), carton(0.02)], 'SAUNA');
  const one = quote([line(p)], dest('NSW'), opts(), card({ chargeBasis: 'product' }, 0));
  assert.equal(one.items.length, 1);
  assert.equal(one.items[0].sizeClass.id, 'large');
  assert.equal(one.lastMile, 100);
  const two = quote([line(p, 2)], dest('NSW'), opts(), card({ chargeBasis: 'product' }, 0));
  assert.equal(two.lastMile, 125);
});

test('zone surcharge applies to last mile only; middle mile is CBM × origin→destination rate', () => {
  const p = product([carton(0.4)]); // large, $100
  const r = quote([line(p)], dest('VIC', 3), opts({ origin: 'NSW' }), card());
  assert.equal(r.lastMile, 100);
  assert.equal(r.zone?.amount, 50);
  assert.deepEqual(r.middleMile && [r.middleMile.from, r.middleMile.to, r.middleMile.rate, r.middleMile.amount], ['NSW', 'VIC', 85, 34]);
  assert.equal(r.fuelLevy.base, 184);
  assert.equal(r.fuelLevy.amount, 7.36);
  assert.equal(r.freightExGst, 191.36);
});

test('matrix is directional (WA→SA differs from SA→WA)', () => {
  const p = product([carton(1)]);
  const wa = quote([line(p)], dest('SA'), opts({ origin: 'WA' }), card({}, 0));
  const sa = quote([line(p)], dest('WA'), opts({ origin: 'SA' }), card({}, 0));
  assert.equal(wa.middleMile?.rate, 300);
  assert.equal(sa.middleMile?.rate, 420);
});

test('ACT is priced as NSW for middle mile', () => {
  const p = product([carton(1)]);
  assert.equal(quote([line(p)], dest('ACT'), opts({ origin: 'NSW' }), card()).middleMile, null);
  assert.equal(quote([line(p)], dest('ACT'), opts({ origin: 'VIC' }), card()).middleMile?.rate, 85);
});

test('warehouse collection: collection rates, no zone, middle mile, fuel or install', () => {
  const p = product([carton(0.05), carton(0.2)], 'SAUNA');
  const r = quote([line(p)], dest('WA', 5), opts({ service: 'collection', install: true }), card());
  assert.equal(r.lastMile, 11 + 10);
  assert.equal(r.zone, null);
  assert.equal(r.middleMile, null);
  assert.equal(r.fuelLevy.amount, 0);
  assert.equal(r.install.amount, 0);
  assert.equal(r.exGst, 21);
});

test('install is per unit, outside the fuel levy', () => {
  const sauna = product([carton(0.5)], 'SAUNA', 'S');
  const bath = product([carton(0.2)], 'ICEBATH', 'B');
  const r = quote([line(sauna, 2), line(bath)], dest('NSW'), opts({ install: true }), card());
  assert.equal(r.install.amount, 2 * 250 + 125);
  assert.equal(r.fuelLevy.base, r.lastMile);
});

test('products without cartons are excluded, not priced as zero', () => {
  const r = quote([line(product([]))], dest('NSW'), opts(), card());
  assert.equal(r.ok, false);
  assert.equal(r.excluded.length, 1);
});

test('greater-of basis lets dead weight push a dense item up a class', () => {
  const heavy = product([carton(0.05, 60)]); // 16.7 kg volumetric, 60 kg dead
  assert.equal(quote([line(heavy)], dest('NSW'), opts(), card({}, 0)).lastMile, 25);
  assert.equal(quote([line(heavy)], dest('NSW'), opts(), card({ sizeBasis: 'greater' }, 0)).lastMile, 60);
});

test('fuel levy formula reproduces the August 2026 announcement (~4%)', () => {
  assert.equal(Math.round(fuelLevyFromPrices(1.9, 2.44, 14)), 4);
});

test('master data parser: finds columns by header, treats 0 as blank, drops cost fields', () => {
  const rows = [
    ['ITEM ID', 'Description', 'Brand', 'Category', 'Cost', 'Supplier', 'RRP', 'Number of Cartons to complete item', 'Carton 1 Code Internal', 'Carton 1 Width (cm)', 'Carton 1 Depth (cm)', 'Carton 1 Height (cm)', 'Carton 1 Weight (kg)', 'Carton 1 CBM', 'Carton 2 CBM'],
    ['R-A', 'Thing', 'Revel', 'sauna', 999, 'Secret Co', 1000, 2, 'R-A_Box1', 100, 100, 50, 40, 0, 0.2],
    ['R-B', 0, 0, 'ACCESSORIES', 5, 'Secret Co', 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [null, null],
  ];
  const { products } = parseMasterData(rows);
  assert.equal(products.length, 2);
  const [a, b] = products;
  assert.equal(a.category, 'SAUNA');
  assert.equal(a.cartons.length, 2);
  assert.equal(a.cartons[0].cbm, 0); // blank CBM column: engine falls back to dimensions
  assert.equal(a.cartons[1].cbm, 0.2);
  assert.equal(b.name, 'R-B');
  assert.equal(b.status, 'no-cartons');
  assert.ok(!JSON.stringify(products).includes('Secret Co'));
  assert.ok(!('cost' in a));
  const r = quote([line(a)], dest('NSW'), opts(), card({}, 0));
  assert.equal(r.items.find((i) => i.label.startsWith('R-A_Box1'))?.cbm, 0.5);
});

test('zone schedule parser: single postcodes, ranges, suburb rows and "Zone 2" text', async () => {
  const { parseZoneSchedule, buildDestination, lookupPostcode } = await import('./zones.ts');
  const { zones, rows, skipped } = parseZoneSchedule([
    ['Winnings coverage schedule'],
    ['Postcode', 'Suburb', 'Delivery Zone'],
    ['2000-2002', '', 'Zone 1'],
    [2250, '', 2],
    [2250, 'Calga', 3],
    ['800', '', 'Z1'],
    ['2999', '', 'TBC'],
  ]);
  assert.equal(rows, 4);
  assert.equal(skipped, 1);
  assert.deepEqual([zones['2000'], zones['2002'], zones['2250'], zones['2250|CALGA'], zones['0800']], [1, 1, 2, 3, 1]);

  const postcodes = { source: '', method: '', postcodes: { '2250': { s: 'NSW' as const, l: [['Calga', 2, 1], ['Gosford', 2, 1]] as any } } };
  const m = lookupPostcode('2250', postcodes)!;
  const schedule = { source: 'x', updated: null, zones };
  assert.equal(buildDestination(m, 'Calga', schedule, null).zone, 3);
  assert.equal(buildDestination(m, 'Gosford', schedule, null).zoneSource, 'schedule');
  assert.equal(buildDestination(m, 'Gosford', { source: null, updated: null, zones: {} }, null).zoneSource, 'estimate');
  assert.equal(buildDestination(m, 'Gosford', schedule, 5).zone, 5);
});

test('closest warehouse: own state, else cheapest middle mile, ACT from NSW', async () => {
  const { closestWarehouse } = await import('./freight.ts');
  const c = card();
  assert.deepEqual(
    (['NSW', 'VIC', 'QLD', 'WA', 'ACT', 'SA', 'TAS', 'NT'] as const).map((s) => closestWarehouse(s, c)),
    ['NSW', 'VIC', 'QLD', 'WA', 'NSW', 'VIC', 'VIC', 'QLD'],
  );
});

test('DFE: fuel levy by date and per-item surcharges', async () => {
  const { quoteDfe, fuelLevyOn } = await import('./dfe.ts');
  const dfe = JSON.parse(readFileSync(new URL('../../public/data/dfe-rate-card.json', import.meta.url), 'utf8'));
  assert.equal(fuelLevyOn(dfe, '2026-09-23').current.pct, 24.5);
  assert.equal(fuelLevyOn(dfe, '2026-09-23').next?.pct, 33.1);
  assert.equal(fuelLevyOn(dfe, '2026-10-07').current.pct, 33.1);
  assert.equal(fuelLevyOn(dfe, '2026-08-20').current.pct, 22.7);

  const box = (w: number, d: number, h: number, kg: number): Carton => ({ code: 'B', widthCm: w, depthCm: d, heightCm: h, weightKg: kg, cbm: 0 });
  // 220 × 150 × 20 cm, 114 kg: cubic 0.66 m³ × 250 = 165 kg chargeable → 5 blocks capped at $35;
  // L+W+H 3.9 m → oversize $8; longest 2.2 m → long length $18.
  const panel = product([box(220, 150, 20, 114)], 'SAUNA');
  const r = quoteDfe([line(panel)], dest('NSW'), dfe, baseCard.rules, [], '2026-09-23');
  assert.deepEqual([r.items[0].weight, r.items[0].oversize, r.items[0].longLength], [35, 8, 18]);
  assert.equal(r.fuelLevy.amount, 14.95); // 24.5% of $61
  assert.equal(r.complete, false);
  // Above 340 kg chargeable: no weight surcharge. Small light box: nothing.
  const heavy = quoteDfe([line(product([box(150, 100, 100, 50)]))], dest('NSW'), dfe, baseCard.rules, [], '2026-09-23');
  assert.equal(heavy.items[0].weight, 0);
  const small = quoteDfe([line(product([box(30, 30, 30, 5)]))], dest('NSW'), dfe, baseCard.rules, ['tailgate'], '2026-09-23');
  assert.deepEqual([small.items[0].weight, small.items[0].oversize, small.items[0].longLength], [0, 0, 0]);
  assert.equal(small.exGst, 56.03); // tailgate $45 + 24.5% levy
});
