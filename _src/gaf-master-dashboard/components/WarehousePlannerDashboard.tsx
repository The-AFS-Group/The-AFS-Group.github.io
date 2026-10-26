import React, { useEffect, useMemo, useState } from 'react';
import './warehousePlanner.css';

/*
 * Warehouse Planner tab: inbound containers and large dispatches for the Gold Coast warehouse.
 *
 * Loaded on demand (React.lazy in Dashboard.tsx), so neither this code nor its data file is
 * downloaded until someone opens the tab.
 *
 * Data: warehouse-planner.json, built by _pipelines/warehouse-planner/build.py from three
 * NetSuite saved-search feeds. Orders carry sales order number and customer type only, never a
 * customer name, because this site is public.
 */

type Brand = { brand: string; units: number; cbm: number };
type Item = { sku: string; name: string; qty: number };
type PoItems = { po: string; items: Item[] };
type Container = {
  id: string; size: string | null; eta: string; etas: string[]; units: number; cbm: number; cartons: number;
  lines: number; pos: string[]; suppliers: string[]; brands: Brand[]; flags: string[]; header_notes: string[];
  po_items?: PoItems[];
};
type Booked = {
  po: string; supplier: string; eta: string; header_eta: string | null; units: number; cbm: number;
  lines: number; brands: Brand[]; flags: string[]; items?: Item[];
};
type Order = { so: string; customer_type: string; ship: string | null; cbm: number; cartons: number; lines: number };
type PlannerData = {
  extract: { generated: string; today: string; snapshot?: boolean; site: string; large_order_cbm: number };
  containers: Container[]; unloaded: Booked[]; orders: Order[]; brand_order: string[];
};
type Selection = { kind: 'c' | 'u' | 'o'; id: string } | null;

const DAY = 86400000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DNAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat–Sun'];
const MIX = ['var(--in)', 'var(--in-2)', 'var(--in-3)'];
const SPANS = [1, 4, 8];
const SPAN_KEY = 'gaf-warehouse-planner-span';

const parse = (iso: string) => { const p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); };
const monday = (t: number) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
const isoWeek = (t: number) => { const y = new Date(t + 3 * DAY).getUTCFullYear(); return 1 + Math.round((monday(t) - monday(Date.UTC(y, 0, 4))) / (7 * DAY)); };
const fmt = (t: number, year = false) => { const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`; };
const fmtIso = (s: string | null) => (s ? fmt(parse(s), true) : 'No date');
const dec = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const m3 = (v: number) => `${dec(v)} m³`;
const n = (v: number) => Math.round(v).toLocaleString('en-AU');
const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((a, x) => a + (f(x) || 0), 0);

function loadSpan() { try { const v = Number(localStorage.getItem(SPAN_KEY)); return SPANS.includes(v) ? v : 1; } catch { return 1; } }
function saveSpan(v: number) { try { localStorage.setItem(SPAN_KEY, String(v)); } catch { /* storage blocked */ } }

// ISO 6346 container code: owner + category letters, serial number, boxed check digit.
const ContainerId: React.FC<{ id: string }> = ({ id }) => {
  const m = /^([A-Z]{4})(\d{6})(\d)(.*)$/.exec(id);
  if (!m) return <span className="wp-cid">{id}</span>;
  return <span className="wp-cid">{m[1]} {m[2]}<span className="chk">{m[3]}</span>{m[4] ? ` ${m[4]}` : ''}</span>;
};

function shares(brands: Brand[]) {
  const tot = sum(brands, (b) => b.cbm);
  return brands.map((b) => ({ ...b, pct: tot ? b.cbm / tot : 1 / brands.length }));
}
const brandNames = (brands: Brand[]) => {
  const names = brands.map((b) => b.brand).filter((b) => b !== 'Unbranded');
  if (!names.length) return 'Spare parts';
  return names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
};

const MixBar: React.FC<{ brands: Brand[] }> = ({ brands }) => (
  <div className="wp-mix" aria-hidden="true">
    {shares(brands).map((b, i) => <span key={b.brand} style={{ flex: Math.max(b.pct, 0.03), background: MIX[Math.min(i, 2)] }} />)}
  </div>
);
const MixLine: React.FC<{ brands: Brand[] }> = ({ brands }) => {
  const s = shares(brands).filter((b) => b.brand !== 'Unbranded');
  if (!s.length) return <div className="wp-mix-line">Spare parts</div>;
  return (
    <div className="wp-mix-line">
      {s.slice(0, 2).map((b, i) => <React.Fragment key={b.brand}>{i > 0 && ' · '}{b.brand} <em>{Math.round(b.pct * 100)}%</em></React.Fragment>)}
      {s.length > 2 && <em> +{s.length - 2}</em>}
    </div>
  );
};

// One PO heading with the SKUs it has in this container (or on this booking), largest quantity first.
const PoBlock: React.FC<{ po: string; items: Item[] }> = ({ po, items }) => (
  <div className="wp-po">
    <div className="wp-po-head">
      <span className="wp-tag">{po}</span>
      <span className="wp-meta num">{plural(items.length, 'SKU', 'SKUs')} · {n(sum(items, (i) => i.qty))} units</span>
    </div>
    <ul className="wp-skus">
      {items.map((it) => (
        <li key={it.sku}>
          <span className="sku">{it.sku}</span>
          <span className="qty num">× {n(it.qty)}</span>
          {it.name && <span className="nm">{it.name}</span>}
        </li>
      ))}
    </ul>
  </div>
);

const WarehousePlannerDashboard: React.FC = () => {
  const [data, setData] = useState<PlannerData | null>(null);
  const [failed, setFailed] = useState(false);
  const [weekStart, setWeekStart] = useState<number | null>(null);
  const [span, setSpanState] = useState<number>(loadSpan);
  const [sel, setSel] = useState<Selection>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}warehouse-planner.json?cb=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: PlannerData) => { setData(d); setWeekStart(monday(parse(d.extract.today))); })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  const today = data ? parse(data.extract.today) : 0;
  const thisWeek = monday(today);

  const itemsFor = useMemo(() => (ws: number, weeks = 1) => {
    if (!data) return { cs: [] as Container[], os: [] as Order[] };
    const we = ws + 7 * weeks * DAY;
    return {
      cs: data.containers.filter((c) => { const t = parse(c.eta); return t >= ws && t < we; }),
      os: data.orders.filter((o) => { if (!o.ship) return false; const t = parse(o.ship); return t >= ws && t < we; }),
    };
  }, [data]);

  if (failed) return <div className="wp"><div className="wp-state err">The warehouse planner extract could not be loaded. Check the nightly job ran, then reload this page.</div></div>;
  if (!data || weekStart === null) return <div className="wp"><div className="wp-state">Loading the warehouse planner…</div></div>;

  const setSpan = (v: number) => { setSpanState(v); saveSpan(v); };
  const openWeek = (ws: number) => { setSpan(1); setWeekStart(ws); };
  const range = itemsFor(weekStart, span);
  const rangeEnd = weekStart + (7 * span - 1) * DAY;
  const dayOf = (iso: string, ws: number) => { const d = Math.round((parse(iso) - ws) / DAY); return d > 4 ? 5 : d; };
  const findC = (id: string) => data.containers.find((c) => c.id === id);
  const findU = (id: string) => data.unloaded.find((u) => u.po === id);
  const findO = (id: string) => data.orders.find((o) => o.so === id);
  const isSel = (kind: string, id: string) => sel?.kind === kind && sel.id === id;

  // ---------- Hero ----------
  const forty = range.cs.filter((c) => c.size === '40ft').length;
  const twenty = range.cs.filter((c) => c.size === '20ft').length;
  const split = [forty ? `${forty} × 40ft` : '', twenty ? `${twenty} × 20ft` : ''].filter(Boolean).join(', ') || 'No containers due';
  const rel = weekStart === thisWeek ? 'This week' : weekStart === thisWeek + 7 * DAY ? 'Next week' : weekStart < thisWeek ? 'Past week' : 'Coming up';
  const eyebrow = span > 1
    ? `Weeks ${isoWeek(weekStart)}–${isoWeek(weekStart + 7 * (span - 1) * DAY)} · ${weekStart === thisWeek ? `Next ${span} weeks` : `${span}-week view`}`
    : `Week ${isoWeek(weekStart)} · ${rel}`;

  // ---------- Outlook ----------
  const outlook = Array.from({ length: 8 }, (_, i) => {
    const ws = thisWeek + i * 7 * DAY, w = itemsFor(ws);
    return { ws, vin: sum(w.cs, (c) => c.cbm), vout: sum(w.os, (o) => o.cbm), nc: w.cs.length, no: w.os.length };
  });
  const outMax = Math.max(1, ...outlook.map((w) => Math.max(w.vin, w.vout)));

  // ---------- Cards ----------
  const ContainerCard = (c: Container) => (
    <button key={c.id} className={`wp-card${isSel('c', c.id) ? ' sel' : ''}`} onClick={() => setSel({ kind: 'c', id: c.id })}>
      <div className="wp-crow">
        <ContainerId id={c.id} />
        <span style={{ display: 'flex', gap: 4 }}>
          {c.flags.includes('overdue') ? <span className="wp-chip crit">⚠ Overdue</span> : c.flags.includes('mixed_eta') ? <span className="wp-chip warn">Mixed ETA</span> : null}
          <span className="wp-chip size">{c.size || 'Size n/a'}</span>
        </span>
      </div>
      <div className="wp-vol num">{dec(c.cbm)}<small>m³</small></div>
      <MixBar brands={c.brands} />
      <MixLine brands={c.brands} />
      <div className="wp-meta num">{n(c.units)} units · {plural(c.pos.length, 'PO', 'POs')}</div>
    </button>
  );
  const OrderCard = (o: Order, max: number) => (
    <button key={o.so} className={`wp-card${isSel('o', o.so) ? ' sel' : ''}`} onClick={() => setSel({ kind: 'o', id: o.so })}>
      <div className="wp-crow"><span className="wp-so">{o.so}</span>{o.cbm >= 10 && <span className="wp-chip ink">10 m³+</span>}</div>
      <div className="wp-type">{o.customer_type}</div>
      <div className="wp-crow"><span className="wp-vol num">{dec(o.cbm)}<small>m³</small></span><span className="wp-meta num">{n(o.cartons)} ctn · {o.lines} lines</span></div>
      <div className="wp-out-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (o.cbm / max) * 100)}%` }} /></div>
    </button>
  );

  // ---------- Week board ----------
  const renderBoard = () => {
    const cols = Array.from({ length: 6 }, () => ({ cs: [] as Container[], os: [] as Order[] }));
    range.cs.forEach((c) => cols[dayOf(c.eta, weekStart)].cs.push(c));
    range.os.forEach((o) => cols[dayOf(o.ship as string, weekStart)].os.push(o));
    const max = Math.max(1, ...cols.map((c) => Math.max(sum(c.cs, (x) => x.cbm), sum(c.os, (x) => x.cbm))));
    const omax = Math.max(1, ...range.os.map((o) => o.cbm));
    return (
      <section className="wp-board-wrap" aria-label="Week board">
        <div className="wp-board">
          {cols.map((col, i) => {
            const start = weekStart + i * DAY, end = i === 5 ? start + DAY : start;
            const isToday = today >= start && today <= end, past = end < today;
            const date = i === 5 ? `${new Date(start).getUTCDate()}–${fmt(start + DAY)}` : fmt(start);
            const vin = sum(col.cs, (c) => c.cbm), vout = sum(col.os, (o) => o.cbm);
            return (
              <div key={i} className={`wp-day${past ? ' past' : ''}${isToday ? ' today' : ''}`}>
                <div className="wp-dhead"><span className="wp-dname">{DNAMES[i]}</span><span className="wp-ddate">{isToday ? 'Today · ' : ''}{date}</span></div>
                <div className="wp-load" aria-label={`Daily volume: ${m3(vin)} in, ${m3(vout)} out`}>
                  <div className="wp-lrow"><span className="k">In</span><div className="wp-track"><div className="wp-fill in" style={{ width: `${(vin / max) * 100}%` }} /></div><span className="v num">{m3(vin)}</span></div>
                  <div className="wp-lrow"><span className="k">Out</span><div className="wp-track"><div className="wp-fill out" style={{ width: `${(vout / max) * 100}%` }} /></div><span className="v num">{m3(vout)}</span></div>
                </div>
                <div className="wp-lane"><span className="label">Inbound containers</span>
                  {col.cs.length ? [...col.cs].sort((a, b) => b.cbm - a.cbm).map(ContainerCard) : <span className="wp-empty">No containers due</span>}
                </div>
                <div className="wp-floor" />
                <div className="wp-lane"><span className="label">Large dispatches</span>
                  {col.os.length ? [...col.os].sort((a, b) => b.cbm - a.cbm).map((o) => OrderCard(o, omax)) : <span className="wp-empty">No large orders</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // ---------- Multi-week calendar ----------
  const Tally = ({ kind, count, vol }: { kind: 'in' | 'out'; count: number; vol: number }) =>
    count ? <div className={`wp-tally ${kind}`}><b>{count}</b> {kind} · {m3(vol)}</div> : null;

  const renderCalendar = () => {
    const rows = Array.from({ length: span }, (_, wk) => {
      const ws = weekStart + wk * 7 * DAY, it = itemsFor(ws);
      const cells = Array.from({ length: 6 }, (_, i) => ({ start: ws + i * DAY, cs: [] as Container[], os: [] as Order[] }));
      it.cs.forEach((c) => cells[dayOf(c.eta, ws)].cs.push(c));
      it.os.forEach((o) => cells[dayOf(o.ship as string, ws)].os.push(o));
      return { ws, it, cells };
    });
    const maxCell = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => Math.max(sum(c.cs, (x) => x.cbm), sum(c.os, (x) => x.cbm)))));
    return (
      <section className="wp-board-wrap" aria-label={`${span}-week calendar`}>
        <div className="wp-cal">
          <div className="wp-cal-head"><span>Week</span>{DNAMES.map((d) => <span key={d}>{d}</span>)}<span>Week total</span></div>
          {rows.map((r) => (
            <div className="wp-cal-row" key={r.ws}>
              <button className="wp-wk-label" onClick={() => openWeek(r.ws)} aria-label={`Open week of ${fmt(r.ws)}`}>
                <b>WK {isoWeek(r.ws)}</b><span>{fmt(r.ws)}</span><em>Open week ›</em>
              </button>
              {r.cells.map((c, i) => {
                const end = i === 5 ? c.start + DAY : c.start, isToday = today >= c.start && today <= end, past = end < today;
                const date = i === 5 ? `${new Date(c.start).getUTCDate()}–${fmt(c.start + DAY)}` : fmt(c.start);
                const cs = [...c.cs].sort((a, b) => b.cbm - a.cbm), os = [...c.os].sort((a, b) => b.cbm - a.cbm);
                const vin = sum(cs, (x) => x.cbm), vout = sum(os, (x) => x.cbm);
                const more = Math.max(0, cs.length - 3) + Math.max(0, os.length - 3), empty = !cs.length && !os.length;
                return (
                  <div key={i} className={`wp-cell${empty ? ' empty' : ''}${past ? ' past' : ''}${isToday ? ' today' : ''}`}>
                    <div className="wp-cell-date"><span className="dn">{DNAMES[i]} · </span>{isToday ? 'Today · ' : ''}{date}</div>
                    <Tally kind="in" count={cs.length} vol={vin} />
                    {cs.slice(0, 3).map((x) => <button key={x.id} className="wp-mini" title={`${x.id} · ${brandNames(x.brands)} · ${m3(x.cbm)}`} onClick={() => setSel({ kind: 'c', id: x.id })}>{x.id.slice(0, 4)} {x.id.slice(4, 10)}{x.size ? ` · ${x.size}` : ''}</button>)}
                    <Tally kind="out" count={os.length} vol={vout} />
                    {os.slice(0, 3).map((o) => <button key={o.so} className="wp-mini" title={`${o.so} · ${o.customer_type} · ${m3(o.cbm)}`} onClick={() => setSel({ kind: 'o', id: o.so })}>{o.so} · {o.customer_type}</button>)}
                    {more > 0 && <button className="wp-more" onClick={() => openWeek(r.ws)}>+{more} more</button>}
                    {!empty && (
                      <div className="wp-cell-load" aria-hidden="true">
                        <span className="in" style={{ width: `${(vin / maxCell) * 100}%` }} />
                        <span className="out" style={{ width: `${(vout / maxCell) * 100}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="wp-wk-total">
                {r.it.cs.length ? <Tally kind="in" count={r.it.cs.length} vol={sum(r.it.cs, (x) => x.cbm)} /> : <div className="wp-tally none">No containers</div>}
                {r.it.os.length ? <Tally kind="out" count={r.it.os.length} vol={sum(r.it.os, (x) => x.cbm)} /> : <div className="wp-tally none">No large orders</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // ---------- Trays ----------
  const overdue = [
    ...data.containers.filter((c) => c.flags.includes('overdue')).map((c) => ({
      key: `c:${c.id}`, sel: { kind: 'c', id: c.id } as Selection, t: <ContainerId id={c.id} />, r: `ETA ${fmtIso(c.eta)}`,
      s: `${brandNames(c.brands)} · ${m3(c.cbm)} · ${c.pos.join(', ')}`,
    })),
    ...data.unloaded.filter((u) => u.flags.length).map((u) => ({
      key: `u:${u.po}`, sel: { kind: 'u', id: u.po } as Selection, t: <>{u.po} · {u.supplier}</>,
      r: u.flags[0] === 'overdue' ? `ETA ${fmtIso(u.eta)}` : 'Lines past ETA', s: `${brandNames(u.brands)} · no container yet`,
    })),
  ];
  const undated = data.orders.filter((o) => !o.ship).sort((a, b) => b.cbm - a.cbm);
  const inRange = (iso: string) => { const t = parse(iso); return t >= weekStart && t < weekStart + 7 * span * DAY; };

  // ---------- Drawer ----------
  const BrandRows = ({ brands }: { brands: Brand[] }) => {
    const max = Math.max(0.001, ...brands.map((b) => b.cbm));
    return (
      <div className="wp-sec" style={{ gap: 10 }}>
        {shares(brands).map((b) => (
          <div className="wp-brow" key={b.brand}>
            <span className="nm">{b.brand}</span>
            <span className="vv num">{m3(b.cbm)}<em>{n(b.units)} units</em></span>
            <div className="wp-track"><div className="wp-fill" style={{ width: `${(b.cbm / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    );
  };

  let drawerKind = '', drawerTitle: React.ReactNode = null, drawerBody: React.ReactNode = null;
  if (sel?.kind === 'c') {
    const c = findC(sel.id);
    if (c) {
      drawerKind = `Inbound container · ${c.size || 'size not recorded'}`;
      drawerTitle = <ContainerId id={c.id} />;
      drawerBody = (<>
        <div className="wp-kv"><div><b className="num">{fmtIso(c.eta)}</b><span>Line ETA</span></div><div><b className="num">{m3(c.cbm)}</b><span>Volume</span></div><div><b className="num">{n(c.cartons)}</b><span>Cartons</span></div></div>
        {c.flags.includes('overdue') && <div className="wp-note crit"><b>⚠ Overdue.</b> The ETA has passed and the stock is not receipted. Check with the forwarder, or receipt it in NetSuite.</div>}
        {c.flags.includes('mixed_eta') && <div className="wp-note"><b>Mixed ETAs.</b> Lines in this container carry {c.etas.map(fmtIso).join(' and ')}. The board uses the date covering most of the volume.</div>}
        <div className="wp-sec"><span className="label">Contents by brand</span><BrandRows brands={c.brands} /></div>
        <div className="wp-sec"><span className="label">Supplier</span><div>{c.suppliers.map((s) => <div key={s}>{s}</div>)}</div></div>
        <div className="wp-sec"><span className="label">Purchase orders and SKUs</span>
          {c.po_items && c.po_items.length
            ? c.po_items.map((p) => <PoBlock key={p.po} po={p.po} items={p.items} />)
            : <div className="wp-tags">{c.pos.map((p) => <span className="wp-tag" key={p}>{p}</span>)}</div>}
        </div>
        {c.header_notes.length > 0 && (
          <div className="wp-sec"><span className="label">Header ETA out of date</span>
            <div className="wp-meta">{c.header_notes.map((h) => { const [po, d] = h.split(' header '); return <div key={h}>{po} header says {fmtIso(d)}</div>; })}</div>
          </div>
        )}
      </>);
    }
  } else if (sel?.kind === 'u') {
    const u = findU(sel.id);
    if (u) {
      drawerKind = 'Booked, not loaded yet';
      drawerTitle = u.po;
      drawerBody = (<>
        <div className="wp-kv"><div><b className="num">{fmtIso(u.eta)}</b><span>Line ETA</span></div><div><b className="num">{m3(u.cbm)}</b><span>Volume</span></div><div><b className="num">{n(u.units)}</b><span>Units</span></div></div>
        <div className="wp-note"><b>No container yet.</b> It moves onto the board once the forwarder confirms a container number.</div>
        {u.flags.includes('some_lines_overdue') && <div className="wp-note crit"><b>⚠ Lines past ETA.</b> Some lines on this PO have an ETA that has already passed.</div>}
        <div className="wp-sec"><span className="label">Contents by brand</span><BrandRows brands={u.brands} /></div>
        <div className="wp-sec"><span className="label">Supplier</span><div>{u.supplier}</div></div>
        {u.items && u.items.length > 0 && <div className="wp-sec"><span className="label">SKUs on this PO</span><PoBlock po={u.po} items={u.items} /></div>}
      </>);
    }
  } else if (sel?.kind === 'o') {
    const o = findO(sel.id);
    if (o) {
      drawerKind = `Large dispatch · ${o.customer_type}`;
      drawerTitle = o.so;
      drawerBody = (<>
        <div className="wp-kv"><div><b className="num">{fmtIso(o.ship)}</b><span>Expected ship</span></div><div><b className="num">{m3(o.cbm)}</b><span>Volume</span></div><div><b className="num">{n(o.cartons)}</b><span>Cartons</span></div></div>
        {!o.ship && <div className="wp-note"><b>No ship date.</b> It appears on the board once sales sets an Expected Ship Date.</div>}
        <div className="wp-sec"><span className="label">Customer type</span><div>{o.customer_type}</div></div>
        <div className="wp-sec"><span className="label">Sales order</span><div className="wp-tags"><span className="wp-tag">{o.so}</span></div><div className="wp-meta">{o.lines} open lines to ship from Gold Coast. Look the order up in NetSuite for customer details.</div></div>
      </>);
    }
  }

  const ex = data.extract;
  return (
    <div className="wp">
      <div className="wp-strip" role="note">
        <span>Warehouse Planner</span><span className="dot" aria-hidden="true" />
        <span className="muted">{ex.site}</span><span className="dot" aria-hidden="true" />
        <span className="muted">{ex.snapshot ? `Example snapshot ${fmt(today, true)}` : `Nightly extract ${fmt(today, true)}`}</span><span className="dot" aria-hidden="true" />
        <span className="muted">{data.containers.length} containers · {data.orders.length} large orders</span>
      </div>

      <section className="wp-hero" aria-label="Selected weeks">
        <div className="wp-hero-top">
          <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
            <span className="wp-eyebrow">{eyebrow}</span>
            <h1>{fmt(weekStart)} <span>–</span> {fmt(rangeEnd)}</h1>
          </div>
          <div className="wp-nav">
            <div className="wp-seg" role="group" aria-label="How many weeks to show">
              {SPANS.map((s) => <button key={s} aria-pressed={span === s} onClick={() => setSpan(s)}>{s} {s === 1 ? 'week' : 'weeks'}</button>)}
            </div>
            <button className="wp-pill ghost" onClick={() => setWeekStart(weekStart - 7 * DAY)} aria-label="Previous week">‹ Prev</button>
            <button className="wp-pill solid" aria-pressed={weekStart === thisWeek} onClick={() => setWeekStart(thisWeek)}>This week</button>
            <button className="wp-pill ghost" onClick={() => setWeekStart(weekStart + 7 * DAY)} aria-label="Next week">Next ›</button>
          </div>
        </div>
        <div className="wp-stats">
          <div className="wp-stat"><span className="k"><i style={{ background: 'var(--gaf-white)' }} />Containers in</span><b className="num">{range.cs.length}</b><span>{split}</span></div>
          <div className="wp-stat"><span className="k">Inbound volume</span><b className="num">{dec(sum(range.cs, (c) => c.cbm))}<small>m³</small></b><span>{n(sum(range.cs, (c) => c.units))} units to receive</span></div>
          <div className="wp-stat"><span className="k"><i style={{ background: 'var(--gaf-orange)' }} />Large dispatches</span><b className="num">{range.os.length}</b><span>Orders of {ex.large_order_cbm} m³ and over</span></div>
          <div className="wp-stat"><span className="k">Dispatch volume</span><b className="num">{dec(sum(range.os, (o) => o.cbm))}<small>m³</small></b><span>{n(sum(range.os, (o) => o.cartons))} cartons</span></div>
        </div>
      </section>

      <section className="wp-panel" aria-label="Eight-week outlook">
        <div className="wp-panel-head">
          <h2>Eight-week outlook</h2>
          <div className="wp-legend"><span><i style={{ background: 'var(--in)' }} />Inbound m³, containers confirmed</span><span><i style={{ background: 'var(--out)' }} />Dispatch m³, orders {ex.large_order_cbm} m³ and over</span></div>
        </div>
        <div className="wp-weeks" onMouseLeave={() => setTip(null)}>
          {outlook.map((w) => {
            const label = `Week of ${fmt(w.ws)}: ${plural(w.nc, 'container', 'containers')}, ${m3(w.vin)} in · ${plural(w.no, 'order', 'orders')}, ${m3(w.vout)} out`;
            const current = w.ws >= weekStart && w.ws < weekStart + 7 * span * DAY;
            return (
              <button key={w.ws} className="wp-wk" aria-current={current} aria-label={label} onClick={() => setWeekStart(w.ws)}
                onMouseMove={(e) => setTip({ text: label, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)}>
                <div className="bars"><div className="b in" style={{ height: `${(w.vin / outMax) * 100}%` }} /><div className="b out" style={{ height: `${(w.vout / outMax) * 100}%` }} /></div>
                <div className="lbl">{fmt(w.ws)}<small>WK {isoWeek(w.ws)}</small></div>
                <div className="val num">{w.nc} in · {w.no} out</div>
              </button>
            );
          })}
        </div>
      </section>

      {span > 1 ? renderCalendar() : renderBoard()}

      <section className="wp-trays" aria-label="Needs attention">
        <div className="wp-panel wp-tray">
          <div className="wp-panel-head"><h2>ETA passed, not received <span className="wp-count crit">{overdue.length}</span></h2><p>Containers or POs whose expected receipt date is before today.</p></div>
          <ul className="wp-list">
            {overdue.length ? overdue.map((x) => (
              <li key={x.key}><button className="wp-item" onClick={() => setSel(x.sel)}><span className="t">{x.t}</span><span className="r">{x.r}</span><span className="s">{x.s}</span></button></li>
            )) : <li><span className="wp-item"><span className="s">Nothing overdue.</span></span></li>}
          </ul>
        </div>
        <div className="wp-panel wp-tray">
          <div className="wp-panel-head"><h2>Booked, not loaded yet <span className="wp-count">{data.unloaded.length}</span></h2><p>On-the-water POs with no container number. Shaded rows have an ETA in the weeks on screen.</p></div>
          <ul className="wp-list">
            {data.unloaded.map((u) => (
              <li key={u.po}><button className={`wp-item${inRange(u.eta) ? ' hl' : ''}`} onClick={() => setSel({ kind: 'u', id: u.po })}>
                <span className="t">{u.po} · {u.supplier}</span><span className="r">{fmtIso(u.eta)}</span><span className="s">{brandNames(u.brands)} · {m3(u.cbm)} · {n(u.units)} units</span>
              </button></li>
            ))}
          </ul>
        </div>
        <div className="wp-panel wp-tray">
          <div className="wp-panel-head"><h2>Large orders, no ship date <span className="wp-count">{undated.length}</span></h2><p>Orders of {ex.large_order_cbm} m³ or more with Expected Ship Date blank. Sales to set a date.</p></div>
          <ul className="wp-list">
            {undated.map((o) => (
              <li key={o.so}><button className="wp-item" onClick={() => setSel({ kind: 'o', id: o.so })}>
                <span className="t">{o.so} · {o.customer_type}</span><span className="r num">{m3(o.cbm)}</span><span className="s">{n(o.cartons)} cartons · {o.lines} lines</span>
              </button></li>
            ))}
          </ul>
        </div>
      </section>

      <details className="wp-panel wp-about">
        <summary>About this data</summary>
        <div className="wp-about-grid">
          <div><span className="label">Inbound</span><p>Open PO lines for the Gold Coast warehouse ticked "Shipment on the water" that still have stock to receive. The ETA is the line's Expected Receipt Date.</p></div>
          <div><span className="label">Containers</span><p>Container numbers come from the AVT container data on each PO line, with size from the AVT container record. A line split across containers is shared out by its quantity in each.</p></div>
          <div><span className="label">Dispatch</span><p>Open Gold Coast sales orders with {ex.large_order_cbm} m³ or more still to ship, dated by the header Expected Ship Date. Shown by sales order number and customer type only.</p></div>
          <div><span className="label">How it updates</span><p>A nightly job turns three NetSuite saved-search feeds into warehouse-planner.json, which this tab reads.{ex.snapshot ? ' The figures shown now are a one-off example snapshot until the nightly feeds are connected.' : ''}</p></div>
        </div>
      </details>

      {sel && <div className="wp-scrim" onClick={() => setSel(null)} />}
      <aside className={`wp-drawer${sel ? ' open' : ''}`} aria-hidden={!sel} aria-label="Details">
        <div className="wp-dr-head">
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}><span className="k">{drawerKind}</span><h2>{drawerTitle}</h2></div>
          <button className="wp-close" onClick={() => setSel(null)}>Close</button>
        </div>
        <div className="wp-dr-body">{drawerBody}</div>
      </aside>
      {tip && <div className="wp-tip" style={{ left: Math.max(8, Math.min(tip.x + 12, window.innerWidth - 340)), top: tip.y + 14 }}>{tip.text}</div>}
    </div>
  );
};

export default WarehousePlannerDashboard;
