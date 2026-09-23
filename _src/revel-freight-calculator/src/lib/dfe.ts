import { cartonCbm, round2, type Destination, type QuoteLine } from './freight';
import type { DfeRateCard, RateCard } from './types';

/**
 * Direct Freight Express, used where Winning Services doesn't deliver.
 *
 * Every carton is an item. Per item: weight surcharge ($7 per 30 kg block over
 * 30 kg, max $35, none above 340 kg chargeable), oversize (L+W+H ≥ 2.2 m) and
 * long length (longest side). Fuel levy applies to the charges DFE marks as
 * levied. Base freight is not priced until DFE's lane / zone rates are loaded,
 * so the result is marked incomplete rather than presenting surcharges as a
 * full quote.
 */

export interface DfeItem {
  label: string;
  deadKg: number;
  cubicKg: number;
  chargeableKg: number;
  longestM: number;
  sumDimsM: number;
  weight: number;
  oversize: number;
  longLength: number;
}

export interface DfeResult {
  complete: boolean;
  items: DfeItem[];
  excluded: string[];
  surcharges: { label: string; amount: number; fuel: boolean }[];
  fuelLevy: { pct: number; effective: string; base: number; amount: number; next?: { effective: string; pct: number } };
  exGst: number;
  gst: number;
  incGst: number;
  warnings: string[];
}

export function fuelLevyOn(dfe: DfeRateCard, isoDate: string) {
  const rows = [...dfe.fuelLevy].sort((a, b) => b.effective.localeCompare(a.effective));
  const current = rows.find((r) => r.effective <= isoDate) ?? rows[rows.length - 1];
  const next = rows.filter((r) => r.effective > isoDate).sort((a, b) => a.effective.localeCompare(b.effective))[0];
  return { current, next };
}

export function quoteDfe(lines: QuoteLine[], dest: Destination | null, dfe: DfeRateCard, rules: RateCard['rules'], optionIds: string[], isoDate: string): DfeResult {
  const s = dfe.itemSurcharges;
  const items: DfeItem[] = [];
  const excluded: string[] = [];
  for (const l of lines) {
    const p = l.product;
    if (p.status !== 'ok' || !p.cartons.length) {
      excluded.push(p.sku);
      continue;
    }
    for (let u = 0; u < Math.max(0, Math.floor(l.qty)); u++) {
      p.cartons.forEach((c, i) => {
        const cubicKg = cartonCbm(c, rules) * dfe.cubicFactor;
        const chargeableKg = Math.max(c.weightKg, cubicKg);
        const dimsM = [c.widthCm, c.depthCm, c.heightCm].map((x) => x / 100);
        const longestM = Math.max(...dimsM);
        const sumDimsM = dimsM.reduce((a, b) => a + b, 0);
        const over = chargeableKg - s.weight.aboveKg;
        const weight = chargeableKg > s.weight.notAboveChargeableKg || over <= 0 ? 0 : Math.min(s.weight.maxPerItem, Math.ceil(over / s.weight.blockKg) * s.weight.perBlock);
        const tier = [...s.longLength].sort((a, b) => b.fromM - a.fromM).find((t) => longestM >= t.fromM);
        items.push({
          label: p.cartons.length > 1 ? `${c.code} · carton ${i + 1} of ${p.cartons.length}` : c.code,
          deadKg: c.weightKg,
          cubicKg,
          chargeableKg,
          longestM,
          sumDimsM,
          weight,
          oversize: sumDimsM >= s.oversize.sumDimsM ? s.oversize.amount : 0,
          longLength: tier?.amount ?? 0,
        });
      });
    }
  }

  const surcharges: DfeResult['surcharges'] = [];
  const sum = (k: 'weight' | 'oversize' | 'longLength') => round2(items.reduce((t, i) => t + i[k], 0));
  if (sum('weight')) surcharges.push({ label: `Weight surcharge (${items.filter((i) => i.weight).length} items)`, amount: sum('weight'), fuel: s.weight.fuel });
  if (sum('oversize')) surcharges.push({ label: `Oversize L+W+H ≥ ${s.oversize.sumDimsM} m (${items.filter((i) => i.oversize).length} items)`, amount: sum('oversize'), fuel: s.oversize.fuel });
  if (sum('longLength')) surcharges.push({ label: `Long length (${items.filter((i) => i.longLength).length} items)`, amount: sum('longLength'), fuel: s.longLengthFuel });
  for (const o of dfe.options.filter((o) => optionIds.includes(o.id))) surcharges.push({ label: o.label, amount: o.amount, fuel: o.fuel });

  const { current, next } = fuelLevyOn(dfe, isoDate);
  const fuelBase = round2(surcharges.filter((x) => x.fuel).reduce((t, x) => t + x.amount, 0));
  const fuelAmount = round2((fuelBase * current.pct) / 100);
  const exGst = round2(surcharges.reduce((t, x) => t + x.amount, 0) + fuelAmount);
  const gst = round2((exGst * dfe.gstPct) / 100);

  const warnings: string[] = [];
  if (!dfe.base) warnings.push('DFE base freight rates are not loaded yet, so this is surcharges only, not a full DFE price.');
  if (dfe.cubicFactorNote) warnings.push(dfe.cubicFactorNote);
  warnings.push('Destination and mining surcharges apply to listed suburbs only. That list has not been supplied.');
  if (dest && !dest.deliverable) warnings.push(`${dest.postcode} ${dest.locality} is a PO box or large-volume-receiver postcode.`);

  return {
    complete: !!dfe.base,
    items,
    excluded,
    surcharges,
    fuelLevy: { pct: current.pct, effective: current.effective, base: fuelBase, amount: fuelAmount, next },
    exGst,
    gst,
    incGst: round2(exGst + gst),
    warnings,
  };
}
