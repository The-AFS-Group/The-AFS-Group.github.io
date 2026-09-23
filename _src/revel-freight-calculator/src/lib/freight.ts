import type { Carton, MatrixState, Product, RateCard, SizeClass, State } from './types';

/**
 * Winning Services freight engine. Pure functions, no UI.
 *
 *   last mile   first item at its size class's minimum charge, every other item
 *               at its class's additional-item rate. The largest item is the
 *               first item. Items are cartons or whole units (rules.chargeBasis).
 *   zone        last mile × zone surcharge %.
 *   middle mile interstate only: total CBM × $/m³ for origin → destination.
 *               ACT is priced as NSW.
 *   fuel levy   % of last mile + zone surcharge + middle mile.
 *   install     optional, per unit, not subject to fuel levy.
 *   GST         on everything.
 *
 * Warehouse collection uses the collection rates and has no zone, middle mile,
 * fuel levy or install.
 */

export type Service = 'delivery' | 'collection';

export interface QuoteLine {
  id: string;
  product: Product;
  qty: number;
}

export interface Destination {
  postcode: string;
  locality: string;
  state: State;
  zone: number;
  zoneSource: 'schedule' | 'estimate' | 'manual';
  deliverable: boolean;
}

export interface QuoteOptions {
  origin: MatrixState;
  service: Service;
  install: boolean;
}

export interface FreightItem {
  lineId: string;
  sku: string;
  label: string;
  cbm: number;
  deadKg: number;
  volKg: number;
  sizeClass: SizeClass;
  role: 'first' | 'additional';
  charge: number;
}

export interface InstallCharge {
  label: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface QuoteResult {
  ok: boolean;
  error?: string;
  items: FreightItem[];
  excluded: { sku: string; name: string; reason: string }[];
  totalCbm: number;
  totalDeadKg: number;
  lastMile: number;
  zone: { zone: number; label: string; pct: number; amount: number } | null;
  middleMile: { from: MatrixState; to: MatrixState; rate: number; cbm: number; amount: number } | null;
  fuelLevy: { pct: number; base: number; amount: number };
  freightExGst: number;
  install: { lines: InstallCharge[]; amount: number };
  exGst: number;
  gst: number;
  incGst: number;
  warnings: string[];
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const dimsCbm = (c: Carton) => (c.widthCm * c.depthCm * c.heightCm) / 1e6;

export function cartonCbm(c: Carton, rules: RateCard['rules']): number {
  const fromDims = dimsCbm(c);
  if (rules.cbmSource === 'dimensions' && fromDims > 0) return fromDims;
  return c.cbm > 0 ? c.cbm : fromDims;
}

export function productCbm(p: Product, rules: RateCard['rules']): number {
  return p.cartons.reduce((s, c) => s + cartonCbm(c, rules), 0);
}

export function productKg(p: Product): number {
  return p.cartons.reduce((s, c) => s + c.weightKg, 0);
}

/** Size classes in ascending order; the last one has no upper bound. */
function orderedClasses(card: RateCard): SizeClass[] {
  return [...card.sizeClasses].sort((a, b) => (a.maxKg ?? Infinity) - (b.maxKg ?? Infinity));
}

export function classify(kg: number, card: RateCard): SizeClass {
  const classes = orderedClasses(card);
  const k = round2(kg);
  return classes.find((c) => c.maxKg === null || k <= c.maxKg) ?? classes[classes.length - 1];
}

export const classRank = (card: RateCard, id: string) => orderedClasses(card).findIndex((c) => c.id === id);

export function chargeKg(cbm: number, deadKg: number, card: RateCard) {
  const volKg = cbm * card.cubicFactor;
  return { volKg, basisKg: card.rules.sizeBasis === 'greater' ? Math.max(volKg, deadKg) : volKg };
}

export const toMatrixState = (s: State): MatrixState => (s === 'ACT' ? 'NSW' : s);

export function installKinds(p: Product): ('sauna' | 'iceBath')[] {
  const c = p.category;
  if (c === 'SAUNA') return ['sauna'];
  if (c === 'ICEBATH' || c === 'ICE BATH') return ['iceBath'];
  if (c === 'CONTRAST PACKAGE') return ['sauna', 'iceBath'];
  return [];
}

export function quote(lines: QuoteLine[], dest: Destination | null, opts: QuoteOptions, card: RateCard): QuoteResult {
  const rules = card.rules;
  const warnings: string[] = [];
  const excluded: QuoteResult['excluded'] = [];
  const pending: Omit<FreightItem, 'role' | 'charge'>[] = [];

  for (const line of lines) {
    const p = line.product;
    const qty = Math.max(0, Math.floor(line.qty));
    if (!qty) continue;
    if (p.status === 'service') {
      excluded.push({ sku: p.sku, name: p.name, reason: 'Service or non-physical SKU, no freight' });
      continue;
    }
    if (!p.cartons.length) {
      excluded.push({ sku: p.sku, name: p.name, reason: 'No carton dimensions in master data' });
      continue;
    }
    for (let u = 0; u < qty; u++) {
      const unit = qty > 1 ? ` (unit ${u + 1})` : '';
      if (rules.chargeBasis === 'product') {
        const cbm = productCbm(p, rules);
        const deadKg = productKg(p);
        const { volKg, basisKg } = chargeKg(cbm, deadKg, card);
        pending.push({ lineId: line.id, sku: p.sku, label: `${p.name}${unit}`, cbm, deadKg, volKg, sizeClass: classify(basisKg, card) });
      } else {
        p.cartons.forEach((c, i) => {
          const cbm = cartonCbm(c, rules);
          const { volKg, basisKg } = chargeKg(cbm, c.weightKg, card);
          const label = p.cartons.length > 1 ? `${c.code} · carton ${i + 1} of ${p.cartons.length}${unit}` : `${c.code}${unit}`;
          pending.push({ lineId: line.id, sku: p.sku, label, cbm, deadKg: c.weightKg, volKg, sizeClass: classify(basisKg, card) });
        });
      }
    }
  }

  const delivery = opts.service === 'delivery';
  pending.sort((a, b) => classRank(card, b.sizeClass.id) - classRank(card, a.sizeClass.id) || b.cbm - a.cbm);
  const items: FreightItem[] = pending.map((it, i) => {
    const sc = it.sizeClass;
    const first = i === 0;
    const charge = delivery ? (first ? sc.deliveryMin : sc.deliveryAdditional) : first ? sc.collectionMin : sc.collectionAdditional;
    return { ...it, role: first ? 'first' : 'additional', charge };
  });

  // Not priceable yet, but items are still returned so the UI can show sizes.
  const unpriced = (error?: string): QuoteResult => ({
    ok: false,
    error,
    items,
    excluded,
    totalCbm: items.reduce((s, i) => s + i.cbm, 0),
    totalDeadKg: items.reduce((s, i) => s + i.deadKg, 0),
    lastMile: 0,
    zone: null,
    middleMile: null,
    fuelLevy: { pct: card.fuelLevy.pct, base: 0, amount: 0 },
    freightExGst: 0,
    install: { lines: [], amount: 0 },
    exGst: 0,
    gst: 0,
    incGst: 0,
    warnings,
  });

  if (!items.length) return unpriced(lines.length ? 'Nothing in this quote has carton dimensions to price.' : undefined);
  if (delivery && !dest) return unpriced('Enter a delivery postcode.');
  if (delivery && dest && !dest.zone) return unpriced('No zone for this postcode. Choose one under "Zone".');

  const totalCbm = items.reduce((s, i) => s + i.cbm, 0);
  const totalDeadKg = items.reduce((s, i) => s + i.deadKg, 0);
  const lastMile = round2(items.reduce((s, i) => s + i.charge, 0));

  let zone: QuoteResult['zone'] = null;
  let middleMile: QuoteResult['middleMile'] = null;
  let fuelBase = 0;
  let fuelAmount = 0;
  const installLines: InstallCharge[] = [];

  if (delivery && dest) {
    const z = card.zones.find((x) => x.zone === dest.zone);
    if (!z) return unpriced(`Zone ${dest.zone} is not on the rate card.`);
    zone = { zone: z.zone, label: z.label, pct: z.surchargePct, amount: round2((lastMile * z.surchargePct) / 100) };

    const from = opts.origin;
    const to = toMatrixState(dest.state);
    if (from !== to) {
      const rate = card.middleMile[from]?.[to];
      if (rate === undefined) warnings.push(`No middle-mile rate for ${from} → ${to} on the rate card; none charged.`);
      else middleMile = { from, to, rate, cbm: totalCbm, amount: round2(rate * totalCbm) };
    }

    fuelBase = round2(lastMile + zone.amount + (middleMile?.amount ?? 0));
    fuelAmount = round2((fuelBase * card.fuelLevy.pct) / 100);

    if (!dest.deliverable) warnings.push(`${dest.postcode} ${dest.locality} is a PO box or large-volume-receiver postcode, not a street address.`);
    if (dest.zoneSource === 'estimate') warnings.push('Zone is estimated from ABS remoteness. Confirm against the Winnings coverage schedule.');

    if (opts.install) {
      const counts = { sauna: 0, iceBath: 0 };
      for (const line of lines) {
        if (line.product.status !== 'ok') continue;
        installKinds(line.product).forEach((k) => (counts[k] += Math.max(0, Math.floor(line.qty))));
      }
      if (counts.sauna) installLines.push({ label: 'Sauna install', qty: counts.sauna, rate: card.install.sauna, amount: round2(counts.sauna * card.install.sauna) });
      if (counts.iceBath) installLines.push({ label: 'Ice bath install', qty: counts.iceBath, rate: card.install.iceBath, amount: round2(counts.iceBath * card.install.iceBath) });
      if (!installLines.length) warnings.push('Install is only priced for saunas and ice baths.');
    }
  }

  const freightExGst = round2(lastMile + (zone?.amount ?? 0) + (middleMile?.amount ?? 0) + fuelAmount);
  const installAmount = round2(installLines.reduce((s, l) => s + l.amount, 0));
  const exGst = round2(freightExGst + installAmount);
  const gst = round2((exGst * card.gstPct) / 100);

  if (excluded.length) warnings.push(`${excluded.length} line${excluded.length > 1 ? 's' : ''} not priced (see below).`);

  return {
    ok: true,
    items,
    excluded,
    totalCbm,
    totalDeadKg,
    lastMile,
    zone,
    middleMile,
    fuelLevy: { pct: card.fuelLevy.pct, base: fuelBase, amount: fuelAmount },
    freightExGst,
    install: { lines: installLines, amount: installAmount },
    exGst,
    gst,
    incGst: round2(exGst + gst),
    warnings,
  };
}

/** Levy from the announcement's formula: ((average − base) / base) × fuel share of operating costs. */
export function fuelLevyFromPrices(basePrice: number, averagePrice: number, fuelSharePct: number): number {
  if (!basePrice) return 0;
  return ((averagePrice - basePrice) / basePrice) * fuelSharePct;
}
