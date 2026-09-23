import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Destination, QuoteLine, QuoteOptions, QuoteResult } from '../lib/freight';
import type { Product, RateCard } from '../lib/types';
import { aud, cbm as fmtCbm, kg as fmtKg, pct } from '../lib/format';

interface Props {
  lines: QuoteLine[];
  setLines: Dispatch<SetStateAction<QuoteLine[]>>;
  result: QuoteResult | null;
  dest: Destination | null;
  opts: QuoteOptions;
  card: RateCard;
  onToast: (msg: string) => void;
}

let customSeq = 1;

function quoteText(lines: QuoteLine[], r: QuoteResult, dest: Destination | null, opts: QuoteOptions, card: RateCard): string {
  const out: string[] = [`Freight quote · ${card.carrier}`];
  if (opts.service === 'delivery' && dest) {
    out.push(`Deliver to: ${dest.postcode} ${dest.locality} ${dest.state} (zone ${dest.zone}${dest.zoneSource === 'estimate' ? ', estimated' : ''}) · dispatch from ${opts.origin}`);
  } else out.push(`Warehouse collection · ${opts.origin}`);
  out.push('');
  lines.forEach((l) => out.push(`${l.qty} × ${l.product.name}${l.product.sku.startsWith('CUSTOM-') ? '' : ` (${l.product.sku})`}`));
  out.push('');
  out.push(`${opts.service === 'delivery' ? 'Last mile' : 'Collection'} (${r.items.length} item${r.items.length === 1 ? '' : 's'}): ${aud(r.lastMile)}`);
  if (r.zone) out.push(`Zone ${r.zone.zone} surcharge (${pct(r.zone.pct)}): ${aud(r.zone.amount)}`);
  if (r.middleMile) out.push(`Middle mile ${r.middleMile.from}→${r.middleMile.to} (${fmtCbm(r.middleMile.cbm)} × ${aud(r.middleMile.rate)}/m³): ${aud(r.middleMile.amount)}`);
  if (r.fuelLevy.amount) out.push(`Fuel levy (${pct(r.fuelLevy.pct)}, ${card.fuelLevy.period}): ${aud(r.fuelLevy.amount)}`);
  r.install.lines.forEach((i) => out.push(`${i.label} (${i.qty} × ${aud(i.rate)}): ${aud(i.amount)}`));
  out.push(`Total ex GST: ${aud(r.exGst)}`);
  out.push(`GST: ${aud(r.gst)}`);
  out.push(`Total inc GST: ${aud(r.incGst)}`);
  if (r.excluded.length) out.push('', `Not priced: ${r.excluded.map((e) => `${e.sku} (${e.reason})`).join('; ')}`);
  return out.join('\n');
}

function CustomItemForm({ onAdd, onCancel }: { onAdd: (p: Product) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', w: '', d: '', h: '', kg: '', cbm: '' });
  const n = (v: string) => Math.max(0, parseFloat(v) || 0);
  const dimsCbm = (n(f.w) * n(f.d) * n(f.h)) / 1e6;
  const cbm = n(f.cbm) || dimsCbm;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cbm) return;
    const id = `CUSTOM-${customSeq++}`;
    const name = f.name.trim() || `Custom item ${customSeq - 1}`;
    onAdd({
      sku: id,
      name,
      brand: '',
      category: 'CUSTOM',
      subCategory: '',
      lifecycle: 'Custom',
      isGroup: false,
      rrp: null,
      declaredCartons: 1,
      cartons: [{ code: name, widthCm: n(f.w), depthCm: n(f.d), heightCm: n(f.h), weightKg: n(f.kg), cbm: n(f.cbm) }],
      status: 'ok',
      issues: [],
    });
  };

  return (
    <form className="custom-form" onSubmit={submit}>
      <label className="field wide">
        <span className="label">Item (one carton)</span>
        <input className="input" placeholder="e.g. New heater, not yet in master data" value={f.name} onChange={set('name')} />
      </label>
      {(['w', 'd', 'h'] as const).map((k) => (
        <label className="field" key={k}>
          <span className="label">{{ w: 'Width', d: 'Depth', h: 'Height' }[k]} cm</span>
          <input className="input num" inputMode="decimal" value={f[k]} onChange={set(k)} />
        </label>
      ))}
      <label className="field">
        <span className="label">Weight kg</span>
        <input className="input num" inputMode="decimal" value={f.kg} onChange={set('kg')} />
      </label>
      <label className="field wide">
        <span className="label">…or CBM directly (m³)</span>
        <input className="input num" inputMode="decimal" placeholder={dimsCbm ? dimsCbm.toFixed(4) : ''} value={f.cbm} onChange={set('cbm')} />
      </label>
      <div className="wide toolbar">
        <span className="small muted">{cbm ? `${fmtCbm(cbm)}` : 'Enter dimensions or CBM'}</span>
        <span className="aside">
          <button type="button" className="btn sm ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn sm primary" disabled={!cbm}>
            Add item
          </button>
        </span>
      </div>
    </form>
  );
}

export default function QuotePanel({ lines, setLines, result, dest, opts, card, onToast }: Props) {
  const [custom, setCustom] = useState(false);
  const r = result;
  const delivery = opts.service === 'delivery';

  const setQty = (id: string, qty: number) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(99, qty || 1)) } : l)));
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.id !== id));

  const copy = async () => {
    if (!r?.ok) return;
    const text = quoteText(lines, r, dest, opts, card);
    try {
      await navigator.clipboard.writeText(text);
      onToast('Quote copied to clipboard');
    } catch {
      onToast('Copy failed. Select the breakdown and copy it manually.');
    }
  };

  return (
    <aside className="card quote" aria-label="Quote">
      <div className="card-head">
        <h2>Quote</h2>
        <span className="small muted">
          {lines.length ? `${lines.reduce((s, l) => s + l.qty, 0)} unit${lines.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}` : ''}
        </span>
        {lines.length > 0 && (
          <button className="btn sm ghost aside" onClick={() => setLines([])}>
            Clear
          </button>
        )}
      </div>

      {r?.ok ? (
        <div className="total">
          <div className="big num">
            {aud(r.incGst)}
            <small>inc GST</small>
          </div>
          <div className="ex num">
            {aud(r.exGst)} ex GST
            {r.install.amount > 0 && <span className="faint"> · includes {aud(r.install.amount)} install</span>}
          </div>
        </div>
      ) : (
        lines.length > 0 && (
          <div className="total">
            <div className="note info">{r?.error ?? 'Enter a delivery postcode above.'}</div>
          </div>
        )
      )}

      {lines.length === 0 ? (
        <div className="hint">
          <b>Price an order</b>
          <ol>
            <li>Enter the delivery postcode above.</li>
            <li>Every product in the list shows its freight for one unit.</li>
            <li>Click a product (or +) to build a multi-item quote. Additional items get the reduced rate.</li>
          </ol>
        </div>
      ) : (
        <ul className="lines">
          {lines.map((l) => (
            <li key={l.id}>
              <div style={{ minWidth: 0 }}>
                <div className="pname" style={{ fontSize: 13 }}>
                  {l.product.name}
                </div>
                <div className="psku">{l.product.sku.startsWith('CUSTOM-') ? 'Custom item' : l.product.sku}</div>
              </div>
              <span className="stepper">
                <button aria-label="Decrease quantity" onClick={() => setQty(l.id, l.qty - 1)}>
                  −
                </button>
                <input aria-label="Quantity" className="num" inputMode="numeric" value={l.qty} onChange={(e) => setQty(l.id, parseInt(e.target.value, 10))} />
                <button aria-label="Increase quantity" onClick={() => setQty(l.id, l.qty + 1)}>
                  +
                </button>
              </span>
              <button className="btn icon sm ghost" aria-label={`Remove ${l.product.name}`} onClick={() => remove(l.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {custom ? (
        <CustomItemForm
          onAdd={(p) => {
            setLines((ls) => [...ls, { id: p.sku, product: p, qty: 1 }]);
            setCustom(false);
          }}
          onCancel={() => setCustom(false)}
        />
      ) : (
        <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--line)' }}>
          <button className="btn sm ghost" onClick={() => setCustom(true)} style={{ paddingLeft: 0 }}>
            + Custom item (not in master data)
          </button>
        </div>
      )}

      {r?.ok && (
        <>
          <table className="breakdown">
            <tbody>
              <tr>
                <td>
                  {delivery ? 'Last mile' : 'Warehouse collection'} · {r.items.length} item{r.items.length === 1 ? '' : 's'}
                </td>
                <td>{aud(r.lastMile)}</td>
              </tr>
              <tr className="sub">
                <td colSpan={2}>
                  First item {aud(r.items[0].charge)} ({r.items[0].sizeClass.label.toLowerCase()} minimum)
                  {r.items.length > 1 && `, then ${r.items.length - 1} at additional-item rates`}
                </td>
              </tr>
              {r.zone && (
                <tr>
                  <td>
                    Zone {r.zone.zone} surcharge · {pct(r.zone.pct)}
                    <div className="faint small">{r.zone.label}</div>
                  </td>
                  <td>{aud(r.zone.amount)}</td>
                </tr>
              )}
              {delivery && (
                <tr>
                  <td>
                    Middle mile
                    <div className="faint small">
                      {r.middleMile
                        ? `${r.middleMile.from} → ${r.middleMile.to} · ${fmtCbm(r.middleMile.cbm)} × ${aud(r.middleMile.rate)}/m³`
                        : `Same state (${opts.origin}), not charged`}
                    </div>
                  </td>
                  <td>{aud(r.middleMile?.amount ?? 0)}</td>
                </tr>
              )}
              {delivery && (
                <tr>
                  <td>
                    Fuel levy · {pct(r.fuelLevy.pct)}
                    <div className="faint small">
                      {card.fuelLevy.period} on {aud(r.fuelLevy.base)}
                    </div>
                  </td>
                  <td>{aud(r.fuelLevy.amount)}</td>
                </tr>
              )}
              <tr className="sum">
                <td>Freight ex GST</td>
                <td>{aud(r.freightExGst)}</td>
              </tr>
              {r.install.lines.map((i) => (
                <tr key={i.label}>
                  <td>
                    {i.label}
                    <div className="faint small">
                      {i.qty} × {aud(i.rate)}, no fuel levy
                    </div>
                  </td>
                  <td>{aud(i.amount)}</td>
                </tr>
              ))}
              <tr>
                <td>GST · {pct(card.gstPct)}</td>
                <td>{aud(r.gst)}</td>
              </tr>
              <tr className="grand">
                <td>Total inc GST</td>
                <td>{aud(r.incGst)}</td>
              </tr>
            </tbody>
          </table>

          <details className="more">
            <summary>
              {r.items.length} item{r.items.length === 1 ? '' : 's'} · {fmtCbm(r.totalCbm)} · {fmtKg(r.totalDeadKg)} dead weight
            </summary>
            <table className="items">
              <tbody>
                {r.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="lbl">
                      {i.label}
                      <div className="faint">
                        {fmtCbm(i.cbm)} → {fmtKg(i.volKg)} volumetric
                        {i.deadKg ? ` · ${fmtKg(i.deadKg)} dead` : ''}
                      </div>
                    </td>
                    <td>
                      <span className={`sc sc-${i.sizeClass.id}`}>{i.sizeClass.label}</span>
                    </td>
                    <td>
                      {aud(i.charge)}
                      <div className="faint">{i.role === 'first' ? 'minimum' : 'additional'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {delivery && (
            <div className="small faint" style={{ padding: '0 18px 12px' }}>
              Futile delivery: {pct(card.futileDeliveryPct)} of the delivery charge ({aud(((r.lastMile + (r.zone?.amount ?? 0)) * card.futileDeliveryPct) / 100)} ex GST) unless Winnings is at fault.
            </div>
          )}
        </>
      )}

      {r && (r.warnings.length > 0 || r.excluded.length > 0) && (
        <div style={{ padding: '0 18px 14px', display: 'grid', gap: 8 }}>
          {r.warnings.length > 0 && (
            <div className="note warn">
              <ul>
                {r.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {r.excluded.map((e) => (
            <div className="note err" key={e.sku}>
              <span>
                <b>{e.sku}</b> not priced: {e.reason}.
              </span>
            </div>
          ))}
        </div>
      )}

      {r?.ok && (
        <div className="quote-foot">
          <button className="btn primary" onClick={copy}>
            Copy quote
          </button>
          <span className="small faint" style={{ alignSelf: 'center' }}>
            {card.rules.chargeBasis === 'carton' ? 'Each carton priced as an item' : 'Each unit priced as one item'} ·{' '}
            {card.rules.cbmSource === 'master' ? 'CBM from master data' : 'CBM from dimensions'}
          </span>
        </div>
      )}
    </aside>
  );
}
