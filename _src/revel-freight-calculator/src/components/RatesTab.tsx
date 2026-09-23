import { useEffect, useState } from 'react';
import { fuelLevyFromPrices, round2 } from '../lib/freight';
import { downloadJson, type Dataset } from '../lib/store';
import { MATRIX_STATES, type RateCard } from '../lib/types';
import { aud, dateLabel } from '../lib/format';

interface Props {
  rateCard: Dataset<RateCard>;
  onSave: (card: RateCard | null) => boolean;
  onToast: (msg: string) => void;
}

function Num({ value, onChange, step = 1, width = 84, suffix, ariaLabel }: { value: number | null; onChange: (v: number) => void; step?: number; width?: number; suffix?: string; ariaLabel: string }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  return (
    <span className="nowrap">
      <input
        className="input cell num"
        style={{ width }}
        inputMode="decimal"
        aria-label={ariaLabel}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {suffix && <span className="faint small"> {suffix}</span>}
    </span>
  );
}

export default function RatesTab({ rateCard, onSave, onToast }: Props) {
  const active = rateCard.active;
  const [draft, setDraft] = useState<RateCard>(() => structuredClone(active));
  useEffect(() => setDraft(structuredClone(active)), [active]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(active);
  const upd = (fn: (d: RateCard) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });

  const f = draft.fuelLevy;
  const calcLevy = fuelLevyFromPrices(f.basePrice, f.averagePrice, f.fuelSharePct);
  const classes = [...draft.sizeClasses].sort((a, b) => (a.maxKg ?? Infinity) - (b.maxKg ?? Infinity));

  const save = () => {
    const ok = onSave({ ...draft, updated: new Date().toISOString().slice(0, 10) });
    onToast(ok ? 'Rates saved in this browser' : 'Could not save: browser storage is blocked');
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="card-body toolbar">
          <span className={`status-dot ${rateCard.local ? 'local' : ''}`} />
          <span>
            {rateCard.local ? (
              <>
                <b>Edited rates saved in this browser</b> <span className="muted">· only you see these until they are published</span>
              </>
            ) : (
              <>
                <b>Published rate card</b> <span className="muted">· {active.source} · updated {dateLabel(active.updated)}</span>
              </>
            )}
          </span>
          <span className="aside">
            <button className="btn sm" onClick={() => downloadJson('winnings-rate-card.json', active)}>
              Download rate card JSON
            </button>
            {rateCard.local && (
              <button
                className="btn sm"
                onClick={() => {
                  onSave(null);
                  onToast('Back to the published rate card');
                }}
              >
                Reset to published
              </button>
            )}
          </span>
        </div>
        {dirty && (
          <div className="card-body toolbar" style={{ borderTop: '1px solid var(--line)', background: 'var(--warn-bg)', borderRadius: '0 0 var(--radius) var(--radius)' }}>
            <b style={{ color: 'var(--warn-ink)' }}>Unsaved changes</b>
            <span className="aside">
              <button className="btn sm ghost" onClick={() => setDraft(structuredClone(active))}>
                Discard
              </button>
              <button className="btn sm primary" onClick={save}>
                Save in this browser
              </button>
            </span>
          </div>
        )}
      </section>

      <div className="two">
        <section className="card">
          <div className="card-head">
            <h2>Fuel levy</h2>
            <span className="small muted">Changes monthly. Applies to last mile, zone surcharge and middle mile.</span>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <div className="toolbar" style={{ gap: 14, alignItems: 'end' }}>
              <label className="field">
                <span className="label">Levy</span>
                <Num ariaLabel="Fuel levy percent" value={f.pct} step={0.1} width={70} suffix="%" onChange={(v) => upd((d) => void (d.fuelLevy.pct = v))} />
              </label>
              <label className="field">
                <span className="label">Period</span>
                <input className="input" style={{ height: 32, width: 150 }} value={f.period} onChange={(e) => upd((d) => void (d.fuelLevy.period = e.target.value))} />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 180 }}>
                <span className="label">Status</span>
                <input className="input" style={{ height: 32 }} value={f.status} onChange={(e) => upd((d) => void (d.fuelLevy.status = e.target.value))} />
              </label>
            </div>
            <div className="note info" style={{ display: 'block' }}>
              <div className="label" style={{ marginBottom: 8 }}>
                Work it out from the Winnings announcement
              </div>
              <div className="toolbar" style={{ gap: 12, alignItems: 'end' }}>
                <label className="field">
                  <span className="small">Base diesel $/L</span>
                  <Num ariaLabel="Base fuel price" value={f.basePrice} step={0.01} width={70} onChange={(v) => upd((d) => void (d.fuelLevy.basePrice = v))} />
                </label>
                <label className="field">
                  <span className="small">Monthly average $/L</span>
                  <Num ariaLabel="Average fuel price" value={f.averagePrice} step={0.01} width={70} onChange={(v) => upd((d) => void (d.fuelLevy.averagePrice = v))} />
                </label>
                <label className="field">
                  <span className="small">Fuel share of costs</span>
                  <Num ariaLabel="Fuel share of operating costs" value={f.fuelSharePct} width={60} suffix="%" onChange={(v) => upd((d) => void (d.fuelLevy.fuelSharePct = v))} />
                </label>
                <span className="small">
                  = <b className="num">{calcLevy.toFixed(2)}%</b>
                </span>
                <button className="btn sm" onClick={() => upd((d) => void (d.fuelLevy.pct = round2(calcLevy)))} disabled={round2(calcLevy) === f.pct}>
                  Use {calcLevy.toFixed(2)}%
                </button>
              </div>
              <div className="small" style={{ marginTop: 8 }}>
                ((average − base) ÷ base) × fuel share. August 2026 notice: (($2.44 − $1.90) ÷ $1.90) × 14% = 3.98%, announced as 4%.
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Calculation rules</h2>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <div className="radio-group" role="radiogroup" aria-label="What counts as an item">
              <span className="label">What counts as an item</span>
              <label className="radio">
                <input type="radio" name="basis" checked={draft.rules.chargeBasis === 'carton'} onChange={() => upd((d) => void (d.rules.chargeBasis = 'carton'))} />
                <span>
                  <b>Each carton</b>
                  <span>A 4-carton sauna is 4 items: the largest at its minimum charge, the other 3 at additional-item rates.</span>
                </span>
              </label>
              <label className="radio">
                <input type="radio" name="basis" checked={draft.rules.chargeBasis === 'product'} onChange={() => upd((d) => void (d.rules.chargeBasis = 'product'))} />
                <span>
                  <b>Each product unit</b>
                  <span>A sauna is 1 item, sized on the total CBM of all its cartons.</span>
                </span>
              </label>
            </div>
            <div className="radio-group" role="radiogroup" aria-label="Size by">
              <span className="label">Size class by</span>
              <label className="radio">
                <input type="radio" name="size" checked={draft.rules.sizeBasis === 'volumetric'} onChange={() => upd((d) => void (d.rules.sizeBasis = 'volumetric'))} />
                <span>
                  <b>Volumetric weight</b>
                  <span>As the rate card states: CBM × {draft.cubicFactor} kg/m³.</span>
                </span>
              </label>
              <label className="radio">
                <input type="radio" name="size" checked={draft.rules.sizeBasis === 'greater'} onChange={() => upd((d) => void (d.rules.sizeBasis = 'greater'))} />
                <span>
                  <b>Greater of dead or volumetric weight</b>
                  <span>Heavy, compact cartons (heaters, stones) move up a class.</span>
                </span>
              </label>
            </div>
            <div className="radio-group" role="radiogroup" aria-label="CBM source">
              <span className="label">Carton CBM from</span>
              <label className="radio">
                <input type="radio" name="cbm" checked={draft.rules.cbmSource === 'master'} onChange={() => upd((d) => void (d.rules.cbmSource = 'master'))} />
                <span>
                  <b>Master data CBM column</b>
                  <span>Dimensions are only used where the CBM cell is blank.</span>
                </span>
              </label>
              <label className="radio">
                <input type="radio" name="cbm" checked={draft.rules.cbmSource === 'dimensions'} onChange={() => upd((d) => void (d.rules.cbmSource = 'dimensions'))} />
                <span>
                  <b>Carton dimensions (W × D × H)</b>
                  <span>Use when the CBM column is known to be stale. The Data tab lists cartons where the two disagree.</span>
                </span>
              </label>
            </div>
            <div className="toolbar" style={{ gap: 14, alignItems: 'end' }}>
              <label className="field">
                <span className="label">Default dispatch</span>
                <select className="select" style={{ height: 32 }} value={draft.rules.defaultOrigin} onChange={(e) => upd((d) => void (d.rules.defaultOrigin = e.target.value as RateCard['rules']['defaultOrigin']))}>
                  {MATRIX_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Cubic factor</span>
                <Num ariaLabel="Cubic factor kg per m3" value={draft.cubicFactor} width={80} suffix="kg/m³" onChange={(v) => upd((d) => void (d.cubicFactor = v))} />
              </label>
              <label className="field">
                <span className="label">GST</span>
                <Num ariaLabel="GST percent" value={draft.gstPct} width={56} suffix="%" onChange={(v) => upd((d) => void (d.gstPct = v))} />
              </label>
            </div>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Last mile and warehouse collection</h2>
          <span className="small muted">First item at the minimum charge, each additional item at the reduced rate. Ex GST.</span>
        </div>
        <div className="card-body table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Size</th>
                <th className="r">Up to (volumetric kg)</th>
                <th className="r">≈ CBM</th>
                <th className="r">Delivery minimum</th>
                <th className="r">Delivery additional</th>
                <th className="r">Collection minimum</th>
                <th className="r">Collection additional</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const i = draft.sizeClasses.findIndex((x) => x.id === c.id);
                const set = (k: 'deliveryMin' | 'deliveryAdditional' | 'collectionMin' | 'collectionAdditional' | 'maxKg') => (v: number) => upd((d) => void ((d.sizeClasses[i] as any)[k] = v));
                return (
                  <tr key={c.id}>
                    <td>
                      <span className={`sc sc-${c.id}`}>{c.label}</span>
                    </td>
                    <td className="r">{c.maxKg === null ? <span className="muted">no limit</span> : <Num ariaLabel={`${c.label} max kg`} value={c.maxKg} onChange={set('maxKg')} />}</td>
                    <td className="r muted num">{c.maxKg === null ? '–' : `${(c.maxKg / draft.cubicFactor).toFixed(3)} m³`}</td>
                    <td className="r">
                      <Num ariaLabel={`${c.label} delivery minimum`} value={c.deliveryMin} onChange={set('deliveryMin')} />
                    </td>
                    <td className="r">
                      <Num ariaLabel={`${c.label} delivery additional`} value={c.deliveryAdditional} onChange={set('deliveryAdditional')} />
                    </td>
                    <td className="r">
                      <Num ariaLabel={`${c.label} collection minimum`} value={c.collectionMin} onChange={set('collectionMin')} />
                    </td>
                    <td className="r">
                      <Num ariaLabel={`${c.label} collection additional`} value={c.collectionAdditional} onChange={set('collectionAdditional')} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <div className="card-head">
            <h2>Zone surcharges</h2>
            <span className="small muted">Added to the last-mile charge.</span>
          </div>
          <div className="card-body table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Zone</th>
                  <th className="r">Surcharge</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {draft.zones.map((z, i) => (
                  <tr key={z.zone}>
                    <td>
                      <b>Zone {z.zone}</b>
                    </td>
                    <td className="r">
                      <Num ariaLabel={`Zone ${z.zone} surcharge`} value={z.surchargePct} width={64} suffix="%" onChange={(v) => upd((d) => void (d.zones[i].surchargePct = v))} />
                    </td>
                    <td>
                      <input className="input" style={{ height: 32, width: '100%' }} value={z.label} onChange={(e) => upd((d) => void (d.zones[i].label = e.target.value))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Install and other charges</h2>
          </div>
          <div className="card-body stack" style={{ gap: 12 }}>
            <div className="toolbar" style={{ gap: 14 }}>
              <label className="field">
                <span className="label">Sauna install</span>
                <Num ariaLabel="Sauna install" value={draft.install.sauna} onChange={(v) => upd((d) => void (d.install.sauna = v))} />
              </label>
              <label className="field">
                <span className="label">Ice bath install</span>
                <Num ariaLabel="Ice bath install" value={draft.install.iceBath} onChange={(v) => upd((d) => void (d.install.iceBath = v))} />
              </label>
              <label className="field">
                <span className="label">Futile delivery</span>
                <Num ariaLabel="Futile delivery percent" value={draft.futileDeliveryPct} width={60} suffix="%" onChange={(v) => upd((d) => void (d.futileDeliveryPct = v))} />
              </label>
            </div>
            {!!draft.otherCharges?.length && (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Reference only</th>
                    <th>Price</th>
                    <th className="hide-sm">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.otherCharges.map((o) => (
                    <tr key={o.item}>
                      <td>{o.item}</td>
                      <td className="nowrap">{o.price}</td>
                      <td className="hide-sm muted small">{o.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Middle mile · $ per m³</h2>
          <span className="small muted">Interstate only. Rows are the dispatch state, columns the delivery state. ACT is priced as NSW.</span>
        </div>
        <div className="card-body table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="origin">From ↓ To →</th>
                {MATRIX_STATES.map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_STATES.map((from) => (
                <tr key={from}>
                  <td className="origin">{from}</td>
                  {MATRIX_STATES.map((to) =>
                    from === to ? (
                      <td key={to} className="self" />
                    ) : (
                      <td key={to}>
                        <Num
                          ariaLabel={`${from} to ${to} per m3`}
                          value={draft.middleMile[from]?.[to] ?? null}
                          width={76}
                          onChange={(v) => upd((d) => void ((d.middleMile[from] ||= {})[to] = v))}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Example: 1.5 m³ from {draft.rules.defaultOrigin} to QLD ={' '}
            {draft.rules.defaultOrigin === 'QLD' ? 'no middle mile' : aud(1.5 * (draft.middleMile[draft.rules.defaultOrigin]?.QLD ?? 0))}. Storage is{' '}
            {aud(draft.storagePerM3PerDay)} per m³ per day (not part of a freight quote).
          </p>
        </div>
      </section>
    </div>
  );
}
