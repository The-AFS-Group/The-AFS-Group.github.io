import { closestWarehouse, productCbm, quote, round2, toMatrixState, type Destination, type QuoteResult } from '../lib/freight';
import { buildDestination, lookupPostcode, scheduleZone, zoneSpread, type PostcodeMatch } from '../lib/zones';
import { quoteDfe, fuelLevyOn, type DfeResult } from '../lib/dfe';
import type { DfeRateCard, MatrixState, PostcodesFile, Product, ProductsFile, RateCard, ZoneScheduleFile } from '../lib/types';

/**
 * Revel Freight · Sales Dashboard (standalone page).
 * Filter to a product, enter the delivery postcode, read the freight.
 * Every figure comes from the embedded Winnings / DFE rate cards and master
 * data; the website catalogue is only used to name and link products.
 */

interface InstallRate { model: string; persons: number | null; install: number | null; rubbish: number | null; oilSilicone: number | null }
interface Installation { source: string; importedAt: string; saunas: InstallRate[]; iceBath: Omit<InstallRate, 'model' | 'persons'> | null }
interface ShipTier { name: string; min: number; max: number | null; rate: number }
interface WebsiteShipping {
  source: string;
  fetchedAt: string;
  gstIncluded: boolean;
  profiles: Record<'small' | 'general', { name: string; states: Record<string, ShipTier[] | string> }>;
  smallItemSkus: string[];
}
interface WebLite { t: string; v: string; u: string; p: number }
interface Embedded {
  builtAt: string;
  products: ProductsFile;
  rateCard: RateCard;
  dfe: DfeRateCard;
  zones: ZoneScheduleFile;
  postcodes: PostcodesFile;
  installation: Installation;
  websiteShipping: WebsiteShipping;
  website: { fetchedAt: string; products: Record<string, WebLite> } | null;
}

const D: Embedded = JSON.parse(document.getElementById('data')!.textContent!);
const card = D.rateCard;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const aud = (n: number) => money.format(n);
const pctf = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const cbmf = (n: number) => `${n < 0.01 ? n.toFixed(4) : n.toFixed(3)} m³`;
const kgf = (n: number) => `${n >= 100 ? Math.round(n) : n.toFixed(1)} kg`;
const dateLong = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- product catalogue ---------- */

type Cat = 'S' | 'I' | 'C' | 'H' | 'R' | 'A';
const CATN: Record<Cat, string> = { S: 'Saunas', I: 'Ice Baths', C: 'Contrast Packages', H: 'Heaters & Controls', R: 'Chillers', A: 'Accessories' };
const CAT_ORDER: Cat[] = ['S', 'I', 'C', 'H', 'R', 'A'];

interface Row {
  p: Product;
  name: string;
  cat: Cat;
  heat: 'I' | 'T' | 'H' | '';
  ppl: number;
  web?: WebLite;
}

const bySku = new Map(D.products.products.map((p) => [p.sku.toUpperCase(), p]));

function nameFor(p: Product, web?: WebLite): string {
  if (p.name && p.name !== p.sku) return p.name;
  if (web) return web.v ? `${web.t} · ${web.v}` : web.t;
  // Bundle SKUs (sauna + heater) with no description: name them after the base sauna.
  const base = [...bySku.values()].filter((b) => b.name !== b.sku && p.sku.toUpperCase().startsWith(b.sku.toUpperCase() + '-')).sort((a, b) => b.sku.length - a.sku.length)[0];
  if (base) return `${base.name} · ${p.sku.slice(base.sku.length + 1)}`;
  return p.sku;
}

function catOf(p: Product): Cat {
  const c = p.category;
  if (c === 'SAUNA') return 'S';
  if (c === 'ICEBATH' || c === 'ICE BATH') return 'I';
  if (c === 'CONTRAST PACKAGE') return 'C';
  if (c === 'HEATER') return 'H';
  if (c === 'CHILLER') return 'R';
  return 'A';
}

function heatOf(p: Product, name: string): Row['heat'] {
  const n = `${name} ${p.sku}`.toUpperCase();
  if (/HYBRID|INFRARED & TRADITIONAL|R-CS-/.test(n)) return 'H';
  if (/INFRARED|FULL SPECTRUM|R-FI-|R-FS-|R-BFS-/.test(n)) return 'I';
  if (/TRADITIONAL|FINNISH|BARREL|R-TR-|R-BT-/.test(n)) return 'T';
  return '';
}

function pplOf(p: Product, name: string): number {
  const m = p.subCategory.match(/^(\d+)P$/) || name.match(/(\d+)(?:-\d+)?\s*Person/i) || p.sku.match(/-(\d+)P(?:-|$)/);
  return m ? Number(m[1]) : 0;
}

const ROWS: Row[] = D.products.products
  .filter((p) => p.status === 'ok' && p.lifecycle !== 'Obsolete')
  .map((p) => {
    const web = D.website?.products[p.sku.toUpperCase()];
    const name = nameFor(p, web);
    return { p, name, cat: catOf(p), heat: heatOf(p, name), ppl: pplOf(p, name), web };
  });
const unpriced = D.products.products.filter((p) => p.status === 'no-cartons').length;

/* ---------- state ---------- */

const S = {
  pc: '',
  locality: '',
  origin: 'auto' as MatrixState | 'auto',
  carrier: 'auto' as 'auto' | 'winnings' | 'dfe',
  cat: new Set<Cat>(),
  heat: new Set<string>(),
  ppl: new Set<number>(),
  disco: false,
  q: '',
  sort: 'cat' as 'cat' | 'freight' | 'cbm' | 'name' | 'var',
  view: 'calc' as 'calc' | 'web',
  open: new Set<string>(),
  qty: new Map<string, number>(),
  /** sku → selected add-on ids */
  addOns: new Map<string, Set<string>>(),
  /** "sku|addOnId" → amount typed in for add-ons with no rate */
  addOnAmt: new Map<string, number>(),
};

type AddOnId = 'install' | 'rubbish' | 'oilSilicone';
const ADDONS: { id: AddOnId; label: string }[] = [
  { id: 'install', label: 'Install' },
  { id: 'rubbish', label: 'Rubbish removal' },
  { id: 'oilSilicone', label: 'Oil & silicone' },
];

// Sauna model from the product name, else from the SKU family.
const SKU_MODEL: [RegExp, string][] = [
  [/^R-FS-PREM/, 'Nova'], [/^R-FS-CABIN/, 'Eclipse'], [/^R-FS-/, 'Aura'], [/^R-FI-/, 'Kora'], [/^R-BFS-/, 'Luna'],
  [/^R-TR-VAL/, 'Kuusi'], [/^R-TR-PREM/, 'Loom'], [/^R-TR-VIRTA/, 'Virta'], [/^R-TR-CAB/, 'Solaris'], [/^R-TR-/, 'Tampere'],
  [/^R-BT-CEDAR-2P/, 'Aurora'], [/^R-BT-CEDAR-/, 'Edenview'], [/^R-BT-/, 'Eden'], [/^R-CS-4P/, 'Nordicwave'],
];
const MODELS = [...new Set(D.installation.saunas.map((x) => x.model))].sort((a, b) => b.length - a.length);

/** Installer-list rows that price this product: its sauna row and/or the ice bath row. */
function installParts(r: Row): { label: string; rate: Omit<InstallRate, 'model' | 'persons'> }[] {
  const parts: { label: string; rate: Omit<InstallRate, 'model' | 'persons'> }[] = [];
  if (r.cat === 'S' || r.cat === 'C') {
    const n = r.name.toUpperCase();
    const outdoorNordic = /^R-CS-CAB/.test(r.p.sku) || /OUTDOOR NORDICWAVE/i.test(r.name);
    const model = outdoorNordic ? undefined : MODELS.find((m) => new RegExp(`\\b${m.toUpperCase()}\\b`).test(n)) ?? SKU_MODEL.find(([re]) => re.test(r.p.sku))?.[1];
    if (model) {
      const range = r.name.match(/(\d+)\s*-\s*(\d+)\s*Person/i);
      const ppl = range ? Number(range[2]) : r.ppl;
      const rows = D.installation.saunas.filter((x) => x.model === model);
      const row = rows.find((x) => x.persons === ppl) ?? (rows.length === 1 && !ppl ? rows[0] : undefined);
      if (row) parts.push({ label: `${row.model}${row.persons ? ` ${row.persons}P` : ''}`, rate: row });
    }
  }
  if ((r.cat === 'I' || r.cat === 'C') && D.installation.iceBath) parts.push({ label: 'Ice bath', rate: D.installation.iceBath });
  return parts;
}

/** Customer charge per unit from the installer list, or null when the product isn't on it for this service. */
function addOnRate(id: AddOnId, r: Row): { rate: number | null; basis: string; na: boolean } {
  const all = installParts(r);
  const parts = all.filter((p) => p.rate[id] !== null);
  if (parts.length) return { rate: round2(parts.reduce((t, p) => t + (p.rate[id] ?? 0), 0)), basis: parts.map((p) => `${p.label} ${aud(p.rate[id]!)}`).join(' + '), na: false };
  // On the list, but the list marks this service N/A for the model.
  if (all.length) return { rate: null, basis: '', na: true };
  const typed = S.addOnAmt.get(`${r.p.sku}|${id}`);
  return { rate: typed ?? null, basis: '', na: false };
}

function addOnLines(r: Row, qty: number) {
  const sel = S.addOns.get(r.p.sku) ?? new Set<string>();
  return ADDONS.filter((a) => sel.has(a.id) && !addOnRate(a.id, r).na).map((a) => {
    const { rate, basis } = addOnRate(a.id, r);
    return { a, rate, basis, listed: !!basis, amount: rate === null ? null : round2(rate * qty) };
  });
}

let match: PostcodeMatch | null = null;
let dest: Destination | null = null;

function resolveDest() {
  match = lookupPostcode(S.pc, D.postcodes);
  if (!match) {
    dest = null;
    return;
  }
  let loc = S.locality;
  if (!match.localities.some((l) => l.name === loc)) {
    // Prefer real suburbs over mail centres ("City Delivery Centre", "GPO", "BC", "MC").
    const mailCentre = (n: string) => /DELIVERY CENTRE|GPO|\bBC$|\bMC$|DC$/i.test(n);
    const deliverable = match.localities.filter((l) => l.deliverable);
    const suburbs = deliverable.filter((l) => !mailCentre(l.name));
    const pool = suburbs.length ? suburbs : deliverable.length ? deliverable : match.localities;
    const z = (l: (typeof pool)[number]) => scheduleZone(D.zones, match!.postcode, l.name) ?? l.zone;
    const counts = new Map<number, number>();
    pool.forEach((l) => counts.set(z(l), (counts.get(z(l)) || 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    loc = (pool.find((l) => z(l) === common) ?? pool[0]).name;
    S.locality = loc;
  }
  dest = buildDestination(match, loc, D.zones, null);
}

const scheduleLoaded = Object.keys(D.zones.zones).length > 0;
function carrier(): 'winnings' | 'dfe' {
  if (S.carrier !== 'auto') return S.carrier;
  if (!dest || !scheduleLoaded) return 'winnings';
  return scheduleZone(D.zones, dest.postcode, dest.locality) === null ? 'dfe' : 'winnings';
}
const origin = (): MatrixState => (S.origin === 'auto' ? closestWarehouse(dest?.state ?? null, card) : S.origin);
const today = new Date().toISOString().slice(0, 10);

function priceRow(r: Row, qty = 1): { w: QuoteResult; d: DfeResult | null } {
  const lines = [{ id: r.p.sku, product: r.p, qty }];
  // Freight only. Install and other add-ons are chosen per product in the breakdown.
  const w = quote(lines, dest, { origin: origin(), service: 'delivery', install: false }, card);
  const d = carrier() === 'dfe' ? quoteDfe(lines, dest, D.dfe, card.rules, [], today) : null;
  return { w, d };
}

/* ---------- render ---------- */

const WH_NAMES: Record<string, string> = { NSW: 'Sydney', VIC: 'Melbourne', QLD: 'Brisbane', WA: 'Perth' };

function renderHeader() {
  const fuel = card.fuelLevy;
  const dl = fuelLevyOn(D.dfe, today);
  $('asof').innerHTML =
    `Winnings rates ex GST · fuel levy <b>${pctf(fuel.pct)}</b> ${esc(fuel.period)} · DFE fuel levy <b>${pctf(dl.current.pct)}</b>` +
    (dl.next ? ` (${pctf(dl.next.pct)} from ${dateLong(dl.next.effective)})` : '') +
    ` · data <b>${dateLong(D.builtAt)}</b>`;
}

function renderDest() {
  resolveDest();
  const sel = $<HTMLSelectElement>('suburb');
  const box = $('place');
  if (!match) {
    sel.hidden = true;
    const digits = S.pc.replace(/\D/g, '');
    box.innerHTML = !digits
      ? `<span class="hint">Enter the delivery postcode to price every product for that address.</span>`
      : digits.length === 4
        ? `<span class="err">Postcode ${esc(digits)} isn't in the Australian postcode list.</span>`
        : `<span class="hint">Keep typing…</span>`;
    return;
  }
  sel.hidden = match.localities.length < 2;
  sel.innerHTML = match.localities
    .map((l) => `<option value="${esc(l.name)}"${l.name === S.locality ? ' selected' : ''}>${esc(l.name)}${l.state !== match!.state ? ` (${l.state})` : ''}${l.deliverable ? '' : ' · PO box'}</option>`)
    .join('');
  const z = card.zones.find((x) => x.zone === dest!.zone);
  const spread = zoneSpread(match, D.zones);
  const o = origin();
  const interstate = toMatrixState(dest!.state) !== o;
  const c = carrier();
  box.innerHTML =
    `<span class="where">${esc(dest!.locality)}, ${dest!.state}</span>` +
    `<span class="meta">` +
    (c === 'winnings'
      ? `<span class="tag s3">Zone ${dest!.zone}${z ? ` · +${z.surchargePct}%` : ''}</span><span>${esc(z?.label ?? '')}${dest!.zoneSource === 'estimate' ? ' · zone estimated' : ''}</span>`
      : `<span class="covwarn">Outside Winnings coverage · DFE</span>`) +
    `<span>· ${interstate ? `interstate from ${o}` : `same state as the ${o} warehouse`}</span>` +
    (spread.length > 1 ? `<span class="covwarn">Suburbs in ${dest!.postcode} span zones ${spread.join(', ')}: check the suburb</span>` : '') +
    (!dest!.deliverable ? `<span class="covwarn">PO box / LVR postcode</span>` : '') +
    `</span>`;
}

function renderBars() {
  const o = origin();
  document.querySelectorAll<HTMLElement>('.wh[data-w]').forEach((el) => {
    const w = el.dataset.w!;
    el.classList.toggle('on', w === S.origin);
    if (w === 'auto') el.textContent = S.origin === 'auto' && S.pc.length >= 3 && dest ? `Closest (${WH_NAMES[o] ?? o})` : 'Closest warehouse';
  });
  document.querySelectorAll<HTMLElement>('.wh[data-c]').forEach((el) => el.classList.toggle('on', el.dataset.c === S.carrier));
  const autoC = document.querySelector<HTMLElement>('.wh[data-c="auto"]');
  if (autoC) autoC.textContent = `Auto (${carrier() === 'dfe' ? 'DFE' : 'Winnings'})`;
  document.querySelectorAll<HTMLElement>('.chip[data-f]').forEach((el) => {
    const f = el.dataset.f!, v = el.dataset.v!;
    const on = f === 'cat' ? S.cat.has(v as Cat) : f === 'heat' ? S.heat.has(v) : S.ppl.has(Number(v));
    el.classList.toggle('on', on);
  });
  $('disco').classList.toggle('on', S.disco);
}

function filtered(): Row[] {
  const q = S.q.trim().toLowerCase();
  return ROWS.filter(
    (r) =>
      (S.disco || r.p.lifecycle !== 'Disco') &&
      (!S.cat.size || S.cat.has(r.cat)) &&
      (!S.heat.size || S.heat.has(r.heat)) &&
      (!S.ppl.size || S.ppl.has(r.ppl)) &&
      (!q || `${r.name} ${r.p.sku} ${r.web?.t ?? ''}`.toLowerCase().includes(q)),
  );
}

function sizeTags(res: QuoteResult): string {
  const counts = new Map<string, { n: number; label: string; rank: number }>();
  const order = [...card.sizeClasses].sort((a, b) => (a.maxKg ?? Infinity) - (b.maxKg ?? Infinity));
  res.items.forEach((i) => {
    const c = counts.get(i.sizeClass.id) ?? { n: 0, label: i.sizeClass.label, rank: order.findIndex((x) => x.id === i.sizeClass.id) };
    c.n++;
    counts.set(i.sizeClass.id, c);
  });
  return [...counts.values()]
    .sort((a, b) => b.rank - a.rank)
    .map((c) => `<span class="tag s${c.rank + 1}">${c.n > 1 ? `${c.n}× ` : ''}${esc(c.label)}</span>`)
    .join('');
}

function detailHtml(r: Row): string {
  const qty = S.qty.get(r.p.sku) ?? 1;
  const { w, d } = priceRow(r, qty);
  const c = carrier();
  const head = `<h4>Freight breakdown · ${c === 'dfe' ? esc(D.dfe.carrier) : esc(card.carrier)}<span class="qty"><label for="q-${esc(r.p.sku)}">Units</label><input id="q-${esc(r.p.sku)}" data-qty="${esc(r.p.sku)}" type="number" min="1" max="99" value="${qty}"></span></h4>`;

  const items = `<table class="bom"><thead><tr><th>${card.rules.chargeBasis === 'carton' ? 'Carton' : 'Unit'}</th><th>CBM</th><th>Vol. kg</th><th>Dead kg</th><th>Size</th><th>Charge</th></tr></thead><tbody>${w.items
    .map(
      (i) =>
        `<tr class="${i.role === 'first' ? 'first' : ''}"><td class="k">${esc(i.label)}</td><td class="num">${cbmf(i.cbm)}</td><td class="num">${kgf(i.volKg)}</td><td class="num">${i.deadKg ? kgf(i.deadKg) : '–'}</td><td>${esc(i.sizeClass.label)}</td><td class="num">${c === 'winnings' && w.ok ? `${aud(i.charge)}<div class="s" style="font-size:10px;color:var(--mut)">${i.role === 'first' ? 'minimum' : 'additional'}</div>` : '–'}</td></tr>`,
    )
    .join('')}</tbody></table>`;

  let lines = '';
  let notes = '';
  if (c === 'dfe' && d) {
    lines =
      `<tr><td>Base freight<div class="s">DFE rate card needed</div></td><td>–</td></tr>` +
      d.surcharges.map((s) => `<tr><td>${esc(s.label)}${s.fuel ? '' : '<div class="s">no fuel levy</div>'}</td><td>${aud(s.amount)}</td></tr>`).join('') +
      (d.surcharges.length ? '' : `<tr><td colspan="2" class="s">No DFE item surcharges apply</td></tr>`) +
      `<tr><td>Fuel levy · ${pctf(d.fuelLevy.pct)}<div class="s">from ${dateLong(d.fuelLevy.effective)} on ${aud(d.fuelLevy.base)}</div></td><td>${aud(d.fuelLevy.amount)}</td></tr>` +
      `<tr class="t"><td>Surcharges ex GST</td><td>${aud(d.exGst)}</td></tr><tr><td>GST · ${pctf(D.dfe.gstPct)}</td><td>${aud(d.gst)}</td></tr><tr class="g"><td>Surcharges inc GST</td><td>${aud(d.incGst)}</td></tr>`;
    notes = d.warnings.map((x) => `<div class="dnote warn">${esc(x)}</div>`).join('');
  } else if (!w.ok) {
    lines = `<tr><td colspan="2" class="s">${esc(w.error ?? 'Enter a delivery postcode above.')}</td></tr>`;
  } else {
    lines =
      `<tr><td>Last mile · ${w.items.length} item${w.items.length === 1 ? '' : 's'}<div class="s">First item ${aud(w.items[0].charge)} (${esc(w.items[0].sizeClass.label.toLowerCase())} minimum)${w.items.length > 1 ? `, ${w.items.length - 1} at additional-item rates` : ''}</div></td><td>${aud(w.lastMile)}</td></tr>` +
      (w.zone ? `<tr><td>Zone ${w.zone.zone} surcharge · ${pctf(w.zone.pct)}<div class="s">${esc(w.zone.label)}</div></td><td>${aud(w.zone.amount)}</td></tr>` : '') +
      `<tr><td>Middle mile<div class="s">${w.middleMile ? `${w.middleMile.from} → ${w.middleMile.to} · ${cbmf(w.middleMile.cbm)} × ${aud(w.middleMile.rate)}/m³` : `Same state (${origin()}), not charged`}</div></td><td>${aud(w.middleMile?.amount ?? 0)}</td></tr>` +
      `<tr><td>Fuel levy · ${pctf(w.fuelLevy.pct)}<div class="s">${esc(card.fuelLevy.period)} on ${aud(w.fuelLevy.base)}</div></td><td>${aud(w.fuelLevy.amount)}</td></tr>` +
      w.install.lines.map((i) => `<tr><td>${esc(i.label)}<div class="s">${i.qty} × ${aud(i.rate)}, no fuel levy</div></td><td>${aud(i.amount)}</td></tr>`).join('') +
      `<tr class="t"><td>Total ex GST</td><td>${aud(w.exGst)}</td></tr><tr><td>GST · ${pctf(card.gstPct)}</td><td>${aud(w.gst)}</td></tr><tr class="g"><td>Total inc GST</td><td>${aud(w.incGst)}</td></tr>`;
    notes = w.warnings.map((x) => `<div class="dnote warn">${esc(x)}</div>`).join('');
  }
  const copy = c === 'winnings' && w.ok ? `<button class="copy" data-copy="${esc(r.p.sku)}">Copy quote</button>` : '';
  return `<div class="detail">${head}<div class="dgrid"><div>${items}</div><div><table class="lines"><tbody>${lines}</tbody></table>${addOnsHtml(r, qty, c === 'winnings' && w.ok ? w : null)}${copy}</div></div>${notes}</div>`;
}

function addOnsHtml(r: Row, qty: number, w: QuoteResult | null): string {
  const sel = S.addOns.get(r.p.sku) ?? new Set<string>();
  const ticks = ADDONS.map((a) => {
    const { rate, basis, na } = addOnRate(a.id, r);
    const id = `ao-${r.p.sku}-${a.id}`;
    const price = na ? 'N/A for this model' : basis ? `${aud(rate!)}${qty > 1 ? ' each' : ''}` : 'not on list · enter amount';
    const cls = na ? ' na' : basis ? '' : ' manual';
    return `<label class="tick${cls}" for="${esc(id)}"><input type="checkbox" id="${esc(id)}" data-addon="${esc(a.id)}" data-sku="${esc(r.p.sku)}"${sel.has(a.id) && !na ? ' checked' : ''}${na ? ' disabled' : ''}><span>${esc(a.label)}</span><span class="tp">${price}</span></label>`;
  }).join('');
  const chosen = addOnLines(r, qty);
  const rows = chosen
    .map(({ a, rate, basis, listed, amount }) =>
      listed
        ? `<tr><td>${esc(a.label)}<div class="s">${qty} × ${aud(rate!)} · ${esc(basis)}</div></td><td>${aud(amount!)}</td></tr>`
        : `<tr><td>${esc(a.label)}<div class="s">Not on the installer list: enter the customer charge per unit</div></td><td><input class="amt" type="number" min="0" step="1" inputmode="decimal" aria-label="${esc(a.label)} customer charge per unit" data-amt="${esc(r.p.sku)}|${esc(a.id)}" value="${rate ?? ''}" placeholder="$">${amount !== null ? `<div class="s">${aud(amount)}</div>` : ''}</td></tr>`,
    )
    .join('');
  const sum = round2(chosen.reduce((t, x) => t + (x.amount ?? 0), 0));
  const totals = chosen.length
    ? `<tr class="t"><td>Add-ons, charge to customer<div class="s">As per the approved installer list · no fuel levy</div></td><td>${aud(sum)}</td></tr>` +
      (w ? `<tr class="g"><td>Freight inc GST + add-ons</td><td>${aud(round2(w.incGst + sum))}</td></tr>` : '')
    : '';
  return `<div class="addons"><div class="lab">Add-on services · not included in freight</div><div class="ticks">${ticks}</div>${chosen.length ? `<table class="lines"><tbody>${rows}${totals}</tbody></table>` : ''}</div>`;
}

/* ---------- website checkout vs actual freight ---------- */

const SMALL = new Set(D.websiteShipping.smallItemSkus.map((x) => x.toUpperCase()));

type SiteCharge =
  | { kind: 'rate'; amount: number; method: string; profile: string }
  | { kind: 'carrier'; method: string; profile: string }
  | { kind: 'none'; profile: string; value: number }
  | { kind: 'off' };

/** What revelsaunas.com.au checkout charges for one unit of this product to this state (cart value = web price). */
function siteCharge(r: Row): SiteCharge {
  if (!r.web || !dest) return { kind: 'off' };
  const key = SMALL.has(r.p.sku.toUpperCase()) ? 'small' : 'general';
  const prof = D.websiteShipping.profiles[key];
  const rules = prof.states[dest.state];
  if (typeof rules === 'string') return { kind: 'carrier', method: rules.replace(/^carrier:/, ''), profile: prof.name };
  const value = r.web.p;
  const tier = (rules ?? []).find((t) => value >= t.min && (t.max === null || value <= t.max));
  return tier ? { kind: 'rate', amount: tier.rate, method: tier.name, profile: prof.name } : { kind: 'none', profile: prof.name, value };
}

function varianceBox(site: SiteCharge, freight: QuoteResult, isDfe: boolean): { html: string; v: number | null } {
  if (site.kind === 'off') return { html: `<div class="var na"><div class="vn">—</div><div class="vl">Not on the website</div></div>`, v: null };
  if (isDfe) return { html: `<div class="var na"><div class="vn">—</div><div class="vl">DFE base rates needed</div></div>`, v: null };
  if (!freight.ok) return { html: `<div class="var na"><div class="vn">—</div><div class="vl">${esc(freight.error ?? '')}</div></div>`, v: null };
  if (site.kind === 'carrier') return { html: `<div class="var warn"><div class="vn">?</div><div class="vl">${esc(site.method)} live quote at checkout</div></div>`, v: null };
  if (site.kind === 'none') return { html: `<div class="var neg"><div class="vn">No rate</div><div class="vl">Checkout has no rate for a ${aud(site.value)} cart in ${dest!.state}</div></div>`, v: null };
  const v = round2(site.amount - freight.incGst);
  const cover = freight.incGst ? Math.round((site.amount / freight.incGst) * 100) : 0;
  const cls = v >= 0 ? 'pos' : 'neg';
  return {
    html: `<div class="var ${cls}"><div class="vn num">${v >= 0 ? '+' : '−'}${aud(Math.abs(v))}</div><div class="vl">${v >= 0 ? 'recovered' : 'short'} · site covers ${cover}%</div></div>`,
    v,
  };
}

function renderWeb() {
  const c = carrier();
  const rows = filtered().filter((r) => r.web);
  const calc = new Map(
    rows.map((r) => {
      const { w } = priceRow(r);
      const site = siteCharge(r);
      return [r.p.sku, { w, site, box: varianceBox(site, w, c === 'dfe') }];
    }),
  );
  const vOf = (r: Row) => calc.get(r.p.sku)!.box.v;
  rows.sort((a, b) => {
    if (S.sort === 'name') return a.name.localeCompare(b.name);
    if (S.sort === 'cat') return CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.name.localeCompare(b.name);
    const va = vOf(a), vb = vOf(b);
    return (va ?? Infinity) - (vb ?? Infinity) || a.name.localeCompare(b.name);
  });

  $('thead').innerHTML =
    `<tr><th data-sort="cat">Product · SKU</th><th>Website checkout${dest ? ` · ${dest.state}` : ''}</th><th class="r">Actual freight${dest ? ` to ${esc(dest.postcode)}` : ''}</th><th class="r" data-sort="var">Variance ↑</th></tr>`;
  let last: Cat | null = null;
  const html = rows
    .map((r) => {
      const { w, site, box } = calc.get(r.p.sku)!;
      let sect = '';
      if (S.sort === 'cat' && r.cat !== last) {
        last = r.cat;
        sect = `<tr><td class="secthead" colspan="4">${CATN[r.cat]}</td></tr>`;
      }
      const siteCell =
        site.kind === 'rate'
          ? `<div class="price num">${aud(site.amount)}</div><div class="ex">${esc(site.method)} · ${esc(site.profile)}</div>`
          : site.kind === 'carrier'
            ? `<div class="price dfe">Live quote</div><div class="ex">${esc(site.method)} · ${esc(site.profile)}</div>`
            : site.kind === 'none'
              ? `<div class="price dfe">No rate</div><div class="ex">${esc(site.profile)} has no tier for ${aud(site.value)}</div>`
              : `<span class="none">${dest ? '' : 'Enter postcode'}</span>`;
      const ours =
        c === 'dfe'
          ? `<div class="price dfe">DFE base rates needed</div>`
          : w.ok
            ? `<div class="price num">${aud(w.incGst)}</div><div class="ex">${esc(card.carrier)}${w.zone ? ` · zone ${w.zone.zone}` : ''}${w.middleMile ? ` · incl. ${aud(w.middleMile.amount)} interstate` : ''}</div>`
            : `<span class="none">${dest ? esc(w.error ?? '') : 'Enter postcode'}</span>`;
      return (
        sect +
        `<tr class="p"><td><div class="pname">${esc(r.name)}</div><div class="sku">${esc(r.p.sku)}</div><div class="tags"><a class="tag web" href="${esc(r.web!.u)}" target="_blank" rel="noopener">${aud(r.web!.p)} on website ↗</a></div></td>` +
        `<td>${siteCell}</td><td class="r">${ours}</td><td class="r">${box.html}</td></tr>`
      );
    })
    .join('');
  $('rows').innerHTML = html || `<tr><td colspan="4" class="none" style="padding:30px;text-align:center">No website products match these filters.</td></tr>`;
  const notOnSite = filtered().length - rows.length;
  $('count').textContent = `${rows.length} product${rows.length === 1 ? '' : 's'} on the website${notOnSite ? ` · ${notOnSite} in this filter aren't sold online` : ''} · 1 unit each · website charges are GST inclusive`;

  const vals = rows.map(vOf).filter((v): v is number => v !== null);
  const short = vals.filter((v) => v < 0);
  const noRate = rows.filter((r) => calc.get(r.p.sku)!.site.kind === 'none').length;
  const carrierQ = rows.filter((r) => calc.get(r.p.sku)!.site.kind === 'carrier').length;
  $('kpis').innerHTML = [
    kpi(dest ? `${dest.postcode} ${dest.state}` : '—', dest ? `${dest.locality}` : 'Delivery postcode', 'b'),
    kpi(vals.length ? `${short.length} / ${vals.length}` : '—', 'Products where the website charge falls short', short.length ? 'r' : 'g'),
    kpi(short.length ? `−${aud(Math.abs(short.reduce((t, v) => t + v, 0)))}` : '—', 'Total shortfall · 1 of each short item', short.length ? 'r' : ''),
    kpi(vals.length ? `${Math.min(...vals) < 0 ? '−' : '+'}${aud(Math.abs(Math.min(...vals)))}` : '—', Math.min(...(vals.length ? vals : [0])) < 0 ? 'Largest single gap' : 'Smallest margin (all recovered)', vals.length && Math.min(...vals) < 0 ? 'r' : ''),
    kpi(noRate || carrierQ ? `${noRate + carrierQ}` : '0', noRate ? 'No checkout rate for this cart value' : carrierQ ? 'Priced by a live carrier quote (not comparable)' : 'Products without a comparable rate', noRate ? 'r' : carrierQ ? 'a' : ''),
  ].join('');
}

function renderTable() {
  if (S.view === 'web') return renderWeb();
  $('thead').innerHTML = `<tr><th data-sort="cat">Product · SKU</th><th data-sort="cbm">Cartons · CBM · size</th><th data-sort="freight" class="r" id="fhead">Freight</th></tr>`;
  const rows = filtered();
  const c = carrier();
  const priced = new Map(rows.map((r) => [r.p.sku, priceRow(r)]));
  const fr = (r: Row) => {
    const x = priced.get(r.p.sku)!;
    return c === 'winnings' && x.w.ok ? x.w.incGst : Infinity;
  };
  rows.sort((a, b) => {
    if (S.sort === 'freight') return fr(a) - fr(b) || a.name.localeCompare(b.name);
    if (S.sort === 'cbm') return productCbm(b.p, card.rules) - productCbm(a.p, card.rules);
    if (S.sort === 'name') return a.name.localeCompare(b.name);
    return CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || a.name.localeCompare(b.name);
  });

  let last: Cat | null = null;
  const html = rows
    .map((r) => {
      const { w, d } = priced.get(r.p.sku)!;
      let sect = '';
      if (S.sort === 'cat' && r.cat !== last) {
        last = r.cat;
        sect = `<tr><td class="secthead" colspan="3">${CATN[r.cat]}</td></tr>`;
      }
      const open = S.open.has(r.p.sku);
      const tags = [
        r.p.lifecycle !== 'Current' ? `<span class="tag">${esc(r.p.lifecycle)}</span>` : '',
        r.web ? `<a class="tag web" href="${esc(r.web.u)}" target="_blank" rel="noopener">${aud(r.web.p)} on website ↗</a>` : '',
        r.p.issues.some((i) => i.startsWith('Carton')) ? `<span class="covwarn" title="${esc(r.p.issues.filter((i) => i.startsWith('Carton')).join('\n'))}">CBM ≠ carton dimensions</span>` : '',
      ].join('');
      let price: string;
      if (c === 'dfe') price = `<div class="price dfe">DFE base rates needed</div><div class="ex">Surcharges ${d ? aud(d.incGst) : '–'} inc GST</div>`;
      else if (w.ok) price = `<div class="price num">${aud(w.incGst)}</div><div class="ex num">${aud(w.exGst)} ex GST${w.middleMile ? ` · incl. ${aud(w.middleMile.amount)} interstate` : ''}</div>`;
      else price = `<span class="none">${S.pc ? esc(w.error ?? '') : 'Enter postcode'}</span>`;
      return (
        sect +
        `<tr class="p"><td><div class="pname">${esc(r.name)}</div><div class="sku">${esc(r.p.sku)}</div>${tags ? `<div class="tags">${tags}</div>` : ''}` +
        `<button class="exp" data-open="${esc(r.p.sku)}" aria-expanded="${open}">${open ? '▾ Hide breakdown' : '▸ Freight breakdown & cartons'}</button>${open ? detailHtml(r) : ''}</td>` +
        `<td><div class="cap"><b>${r.p.cartons.length}</b> carton${r.p.cartons.length === 1 ? '' : 's'} · <b>${cbmf(productCbm(r.p, card.rules))}</b></div><div class="tags">${sizeTags(w)}</div></td>` +
        `<td class="r">${price}</td></tr>`
      );
    })
    .join('');
  $('rows').innerHTML = html || `<tr><td colspan="3" class="none" style="padding:30px;text-align:center">No products match these filters.</td></tr>`;
  $('fhead').textContent = dest ? `Freight to ${dest.postcode} ${dest.locality} · 1 unit` : 'Freight · 1 unit';
  $('count').textContent = `${rows.length} product${rows.length === 1 ? '' : 's'}${unpriced ? ` · ${unpriced} SKUs without carton data aren't listed` : ''}`;

  // KPIs
  const vals = rows.map((r) => priced.get(r.p.sku)!.w).filter((x) => c === 'winnings' && x.ok).map((x) => x.incGst);
  const z = dest ? card.zones.find((x) => x.zone === dest!.zone) : null;
  $('kpis').innerHTML = [
    kpi(dest ? `${dest.postcode}` : '—', dest ? `${dest.locality}, ${dest.state}` : 'Delivery postcode', 'b'),
    kpi(c === 'dfe' ? 'DFE' : dest ? `Zone ${dest.zone}` : '—', c === 'dfe' ? 'Outside Winnings coverage' : z ? `+${z.surchargePct}% · ${z.label}${dest!.zoneSource === 'estimate' ? ' (est.)' : ''}` : 'Winnings zone', c === 'dfe' ? 'a' : 'b'),
    kpi(dest ? `${WH_NAMES[origin()] ?? origin()}` : '—', dest ? (toMatrixState(dest.state) === origin() ? 'Dispatch · same state' : `Dispatch · interstate to ${toMatrixState(dest.state)}`) : 'Dispatch warehouse', ''),
    kpi(vals.length ? aud(Math.min(...vals)) : '—', 'Lowest freight in this list', 'g'),
    kpi(vals.length ? aud(Math.max(...vals)) : '—', 'Highest freight in this list', ''),
  ].join('');
}

const kpi = (n: string, l: string, cls: string) => `<div class="kpi ${cls}"><div class="n num">${esc(n)}</div><div class="l">${esc(l)}</div></div>`;

function renderFooter() {
  if (S.view === 'web') {
    $('foot').innerHTML =
      `<p><b>Website checkout</b> is what revelsaunas.com.au charges the customer for shipping, from the store's Shopify shipping profiles (${esc(D.websiteShipping.source)}). It depends only on the delivery <b>state</b> and the <b>cart value</b> (here, one unit at its web price), not the postcode, zone or product size. Small Items pay a flat ${aud((D.websiteShipping.profiles.small.states.NSW as ShipTier[])[0].rate)}. WA on the General profile is quoted live by Smartfreight, so it can't be compared here.</p>` +
      `<p><b>Actual freight</b> is this dashboard's Winnings cost to the postcode entered, from the closest warehouse unless you pick one, inc GST. <b>Variance</b> = website charge − actual freight: green is recovered, red is freight Revel absorbs. Add-ons (install, rubbish, oil &amp; silicone) are not included on either side.</p>` +
      `<p><b>Gaps in the checkout setup:</b> General-profile carts under $99 have no rate outside WA, and in QLD there is no rate between $1,799.01 and $1,898.99 (the upper tier starts at $1,899, other states at $1,800).</p>`;
    return;
  }
  const sc = [...card.sizeClasses].sort((a, b) => (a.maxKg ?? Infinity) - (b.maxKg ?? Infinity));
  $('foot').innerHTML =
    `<p><b>How freight is worked out.</b> Every carton in master data is an item. Its CBM × ${card.cubicFactor} kg/m³ gives volumetric weight and a size: ${sc
      .map((s) => `${s.label} ${s.maxKg === null ? `over ${sc[sc.length - 2].maxKg} kg` : `≤ ${s.maxKg} kg`} (${aud(s.deliveryMin)} first / ${aud(s.deliveryAdditional)} additional)`)
      .join(', ')}. The largest carton pays its minimum, the rest the additional rate. The zone surcharge is added to that last-mile charge; interstate adds the <b>middle mile</b> (total CBM × $/m³, origin → destination); then the <b>fuel levy</b> and GST.</p>` +
    `<p><b>Dispatch</b> is the closest Revel warehouse (${(card.warehouses ?? []).map((w) => `${w.state} ${w.name}`).join(', ')}); SA and TAS ship from VIC, NT from QLD, ACT from NSW. Pick a warehouse above to price from somewhere else.</p>` +
    `<p><b>Zones</b> are ${scheduleLoaded ? `from the Winnings coverage schedule (${esc(D.zones.source ?? '')})` : 'estimated from ABS remoteness (Major Cities 1 … Very Remote 5) until the Winnings coverage schedule is supplied'}. <b>DFE</b> is used for postcodes outside Winnings coverage${scheduleLoaded ? '' : ' (once that schedule is loaded; choose DFE above to preview)'}; its base freight rates are still to come, so DFE shows surcharges and fuel levy only.</p>` +
    `<p><b>Add-ons</b> (install, rubbish removal, oil &amp; silicone) are never included in freight. Tick them per product; prices are the “Total Charge to customer” from ${esc(D.installation.source)}.</p>` +
    `<p>Sources: ${esc(card.source)}; ${esc(D.dfe.source)}; master data ${esc(D.products.source)}. Product names and links from revelsaunas.com.au are for checking only; no website prices or shipping are used in the freight. Rates ex GST unless shown inc GST.</p>`;
}

function renderAll() {
  renderDest();
  renderBars();
  renderTable();
}

/* ---------- events ---------- */

$<HTMLInputElement>('pc').addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  el.value = el.value.replace(/\D/g, '').slice(0, 4);
  S.pc = el.value;
  S.locality = '';
  renderAll();
});
$<HTMLSelectElement>('suburb').addEventListener('change', (e) => {
  S.locality = (e.target as HTMLSelectElement).value;
  renderAll();
});
$<HTMLInputElement>('search').addEventListener('input', (e) => {
  S.q = (e.target as HTMLInputElement).value;
  renderTable();
});
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const vt = t.closest<HTMLElement>('.vt[data-view]');
  if (vt) {
    S.view = vt.dataset.view as typeof S.view;
    S.sort = S.view === 'web' ? 'var' : 'cat';
    document.querySelectorAll<HTMLElement>('.vt').forEach((b) => b.setAttribute('aria-selected', String(b === vt)));
    renderFooter();
    return renderAll();
  }
  const qp = t.closest<HTMLElement>('.qp[data-pc]');
  if (qp) {
    S.pc = qp.dataset.pc!;
    S.locality = '';
    $<HTMLInputElement>('pc').value = S.pc;
    return renderAll();
  }
  const wh = t.closest<HTMLElement>('.wh[data-w]');
  if (wh) return (S.origin = wh.dataset.w as MatrixState | 'auto'), renderAll();
  const cr = t.closest<HTMLElement>('.wh[data-c]');
  if (cr) return (S.carrier = cr.dataset.c as typeof S.carrier), renderAll();
  const chip = t.closest<HTMLElement>('.chip[data-f]');
  if (chip) {
    const f = chip.dataset.f!, v = chip.dataset.v!;
    const set = (f === 'cat' ? S.cat : f === 'heat' ? S.heat : S.ppl) as Set<string | number>;
    const val = f === 'ppl' ? Number(v) : v;
    set.has(val) ? set.delete(val) : set.add(val);
    return renderAll();
  }
  if (t.closest('#disco')) return (S.disco = !S.disco), renderAll();
  const ad = t.closest<HTMLElement>('input[data-addon]');
  if (ad) {
    const sku = ad.dataset.sku!, id = ad.dataset.addon!;
    const set = S.addOns.get(sku) ?? new Set<string>();
    set.has(id) ? set.delete(id) : set.add(id);
    S.addOns.set(sku, set);
    return renderTable();
  }
  if (t.closest('#reset')) {
    S.cat.clear();
    S.heat.clear();
    S.ppl.clear();
    S.disco = false;
    S.q = '';
    $<HTMLInputElement>('search').value = '';
    return renderAll();
  }
  const th = t.closest<HTMLElement>('th[data-sort]');
  if (th) return (S.sort = th.dataset.sort as typeof S.sort), renderTable();
  const ex = t.closest<HTMLElement>('[data-open]');
  if (ex) {
    const k = ex.dataset.open!;
    S.open.has(k) ? S.open.delete(k) : S.open.add(k);
    return renderTable();
  }
  const cp = t.closest<HTMLElement>('[data-copy]');
  if (cp) copyQuote(cp.dataset.copy!);
});
document.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.amt) {
    const v = parseFloat(t.value);
    Number.isFinite(v) && v >= 0 ? S.addOnAmt.set(t.dataset.amt, v) : S.addOnAmt.delete(t.dataset.amt);
    renderTable();
    return;
  }
  if (t.dataset.qty) {
    S.qty.set(t.dataset.qty, Math.max(1, Math.min(99, parseInt(t.value, 10) || 1)));
    renderTable();
    document.getElementById(`q-${t.dataset.qty}`)?.focus();
  }
});
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if ((e.key === 'Enter' || e.key === ' ') && t.matches('.chip,.wh')) {
    e.preventDefault();
    t.click();
  }
});

async function copyQuote(sku: string) {
  const r = ROWS.find((x) => x.p.sku === sku);
  if (!r || !dest) return;
  const qty = S.qty.get(sku) ?? 1;
  const { w } = priceRow(r, qty);
  if (!w.ok) return;
  const text = [
    `Freight quote · ${card.carrier}`,
    `${qty} × ${r.name} (${sku})`,
    `Deliver to ${dest.postcode} ${dest.locality} ${dest.state}, zone ${dest.zone}${dest.zoneSource === 'estimate' ? ' (estimated)' : ''}, from ${origin()}`,
    `Last mile ${aud(w.lastMile)}${w.zone?.amount ? ` · zone surcharge ${aud(w.zone.amount)}` : ''}${w.middleMile ? ` · middle mile ${aud(w.middleMile.amount)}` : ''} · fuel levy ${aud(w.fuelLevy.amount)}`,
    `Freight ${aud(w.exGst)} ex GST · ${aud(w.incGst)} inc GST`,
    ...addOnLines(r, qty).map(({ a, amount }) => `${a.label}: ${amount === null ? 'amount to confirm' : aud(amount)}`),
  ].join('\n');
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = false;
  }
  const el = $('toast');
  el.textContent = ok ? 'Quote copied' : 'Copy is blocked here. Select the breakdown to copy it.';
  el.hidden = false;
  setTimeout(() => (el.hidden = true), 2200);
}

renderHeader();
renderFooter();
renderAll();
