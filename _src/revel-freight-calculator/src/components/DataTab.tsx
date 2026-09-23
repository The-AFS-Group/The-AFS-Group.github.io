import { useMemo, useRef, useState } from 'react';
import { parseMasterData, pickSheetName } from '../lib/masterData';
import { parseZoneSchedule } from '../lib/zones';
import { downloadJson, readSpreadsheet, type AppData } from '../lib/store';
import type { ProductsFile, ZoneScheduleFile } from '../lib/types';
import { dateLabel, titleCase } from '../lib/format';

interface Props {
  data: AppData;
  setLocal: <K extends 'products' | 'rateCard' | 'zones'>(kind: K, value: AppData[K]['published'] | null) => boolean;
  onToast: (msg: string) => void;
}

function DropZone({ accept, label, onFile, busy }: { accept: string; label: string; onFile: (f: File) => void; busy: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`drop ${over ? 'over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <div style={{ marginBottom: 8 }}>{busy ? 'Reading file…' : label}</div>
      <button className="btn sm" onClick={() => input.current?.click()} disabled={busy}>
        Choose file
      </button>
    </div>
  );
}

type Pending<T> = { value: T; summary: string[] } | null;

export default function DataTab({ data, setLocal, onToast }: Props) {
  const [busy, setBusy] = useState<'products' | 'zones' | null>(null);
  const [err, setErr] = useState<{ kind: string; msg: string } | null>(null);
  const [pendingProducts, setPendingProducts] = useState<Pending<ProductsFile>>(null);
  const [pendingZones, setPendingZones] = useState<Pending<ZoneScheduleFile>>(null);
  const [issueFilter, setIssueFilter] = useState<'all' | 'cbm' | 'missing' | 'desc'>('all');

  const products = data.products.active;
  const zones = data.zones.active;
  const zoneCount = Object.keys(zones.zones).length;

  const uploadProducts = async (file: File) => {
    setBusy('products');
    setErr(null);
    try {
      const book = await readSpreadsheet(file);
      const sheet = pickSheetName(book.sheetNames, book.rowsOf);
      const { products: parsed, skipped } = parseMasterData(book.rowsOf(sheet));
      if (!parsed.length) throw new Error('No product rows found under the ITEM ID header.');
      const before = new Map(products.products.map((p) => [p.sku, p]));
      const added = parsed.filter((p) => !before.has(p.sku));
      const removed = products.products.filter((p) => !parsed.some((x) => x.sku === p.sku));
      const changed = parsed.filter((p) => {
        const b = before.get(p.sku);
        return b && JSON.stringify(b.cartons) !== JSON.stringify(p.cartons);
      });
      const summary = [
        `${parsed.length} products from sheet "${sheet}" (${parsed.filter((p) => p.status === 'ok').length} can be priced)`,
        `${added.length} new${added.length ? `: ${added.slice(0, 8).map((p) => p.sku).join(', ')}${added.length > 8 ? '…' : ''}` : ''}`,
        `${changed.length} with changed cartons${changed.length ? `: ${changed.slice(0, 8).map((p) => p.sku).join(', ')}${changed.length > 8 ? '…' : ''}` : ''}`,
        `${removed.length} no longer in the file${removed.length ? `: ${removed.slice(0, 8).map((p) => p.sku).join(', ')}${removed.length > 8 ? '…' : ''}` : ''}`,
      ];
      if (skipped) summary.push(`${skipped} rows skipped (blank or duplicate SKU)`);
      setPendingProducts({ value: { source: `${file.name} · sheet "${sheet}" (uploaded in browser)`, importedAt: new Date().toISOString(), products: parsed }, summary });
    } catch (e: any) {
      setErr({ kind: 'products', msg: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const uploadZones = async (file: File) => {
    setBusy('zones');
    setErr(null);
    try {
      const book = await readSpreadsheet(file);
      let parsed: ReturnType<typeof parseZoneSchedule> | null = null;
      let lastErr: unknown = null;
      for (const name of book.sheetNames) {
        try {
          parsed = parseZoneSchedule(book.rowsOf(name));
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!parsed) throw lastErr ?? new Error('No usable sheet found');
      const values = Object.values(parsed.zones);
      const byZone = [1, 2, 3, 4, 5].map((z) => `zone ${z}: ${values.filter((v) => v === z).length}`).join(', ');
      setPendingZones({
        value: { source: file.name, updated: new Date().toISOString(), zones: parsed.zones },
        summary: [`${Object.keys(parsed.zones).length} postcodes / suburbs from ${parsed.rows} rows`, byZone, ...(parsed.skipped ? [`${parsed.skipped} rows skipped (no postcode or numeric zone)`] : [])],
      });
    } catch (e: any) {
      setErr({ kind: 'zones', msg: e?.message || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const issues = useMemo(() => {
    return products.products
      .filter((p) => p.status !== 'service' && p.issues.length)
      .filter((p) => {
        if (issueFilter === 'cbm') return p.issues.some((i) => i.startsWith('Carton'));
        if (issueFilter === 'missing') return p.issues.some((i) => /No carton|only \d+ have/.test(i));
        if (issueFilter === 'desc') return p.issues.some((i) => i.startsWith('No description'));
        return true;
      });
  }, [products, issueFilter]);

  const counts = {
    cbm: products.products.filter((p) => p.issues.some((i) => i.startsWith('Carton'))).length,
    missing: products.products.filter((p) => p.status !== 'service' && p.issues.some((i) => /No carton|only \d+ have/.test(i))).length,
    desc: products.products.filter((p) => p.issues.some((i) => i.startsWith('No description'))).length,
  };

  return (
    <div className="stack">
      <div className="two">
        <section className="card">
          <div className="card-head">
            <h2>Master data</h2>
            <span className={`tag ${data.products.local ? 'warn' : 'ok'} aside`}>{data.products.local ? 'Uploaded in this browser' : 'Published'}</span>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            <dl className="kv">
              <dt>Source</dt>
              <dd>{products.source}</dd>
              <dt>Imported</dt>
              <dd>{dateLabel(products.importedAt)}</dd>
              <dt>Products</dt>
              <dd>
                {products.products.length} · {products.products.filter((p) => p.status === 'ok').length} priced ·{' '}
                {products.products.filter((p) => p.status === 'no-cartons').length} missing cartons · {products.products.filter((p) => p.status === 'service').length} services
              </dd>
            </dl>
            {pendingProducts ? (
              <div className="note info" style={{ display: 'block' }}>
                <b>Ready to apply</b>
                <ul style={{ marginTop: 6 }}>
                  {pendingProducts.summary.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <div className="toolbar" style={{ marginTop: 10 }}>
                  <button
                    className="btn sm primary"
                    onClick={() => {
                      const ok = setLocal('products', pendingProducts.value);
                      setPendingProducts(null);
                      onToast(ok ? 'Master data applied in this browser' : 'Applied for this session only: browser storage is blocked');
                    }}
                  >
                    Use this master data
                  </button>
                  <button className="btn sm ghost" onClick={() => setPendingProducts(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <DropZone accept=".xlsx,.xls,.xlsm,.csv" label="Drop the Master Data Succinct workbook here" onFile={uploadProducts} busy={busy === 'products'} />
            )}
            {err?.kind === 'products' && <div className="note err">{err.msg}</div>}
            <p className="small muted" style={{ margin: 0 }}>
              Read in your browser. Only SKU, description, brand, category, lifecycle, RRP and carton dimensions are kept: cost, wholesale and supplier columns are ignored.
            </p>
            <div className="toolbar">
              <button className="btn sm" onClick={() => downloadJson('products.json', products)}>
                Download products.json
              </button>
              {data.products.local && (
                <button
                  className="btn sm"
                  onClick={() => {
                    setLocal('products', null);
                    onToast('Back to the published master data');
                  }}
                >
                  Reset to published
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Postcode zones</h2>
            <span className={`tag ${zoneCount ? 'ok' : 'warn'} aside`}>{zoneCount ? 'Winnings schedule' : 'Estimated'}</span>
          </div>
          <div className="card-body stack" style={{ gap: 14 }}>
            {zoneCount ? (
              <dl className="kv">
                <dt>Schedule</dt>
                <dd>
                  {zones.source} {data.zones.local ? '(uploaded in this browser)' : ''}
                </dd>
                <dt>Entries</dt>
                <dd>{zoneCount} postcodes / suburbs</dd>
                <dt>Updated</dt>
                <dd>{dateLabel(zones.updated)}</dd>
                <dt>Elsewhere</dt>
                <dd style={{ fontWeight: 400 }}>Postcodes not on the schedule fall back to the estimate.</dd>
              </dl>
            ) : (
              <div className="note warn" style={{ display: 'block' }}>
                <b>Zones are estimated.</b> The rate card points to the Winnings coverage and delivery schedule for zones 1 to 5, which wasn't supplied. Until it is uploaded, each suburb's zone comes from its ABS
                Remoteness Area: Major Cities 1, Inner Regional 2, Outer Regional 3, Remote 4, Very Remote 5 (Greater Hobart and Darwin set to 1). You can override the zone on any quote.
              </div>
            )}
            {pendingZones ? (
              <div className="note info" style={{ display: 'block' }}>
                <b>Ready to apply</b>
                <ul style={{ marginTop: 6 }}>
                  {pendingZones.summary.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <div className="toolbar" style={{ marginTop: 10 }}>
                  <button
                    className="btn sm primary"
                    onClick={() => {
                      const ok = setLocal('zones', pendingZones.value);
                      setPendingZones(null);
                      onToast(ok ? 'Zone schedule applied in this browser' : 'Applied for this session only: browser storage is blocked');
                    }}
                  >
                    Use this schedule
                  </button>
                  <button className="btn sm ghost" onClick={() => setPendingZones(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <DropZone accept=".xlsx,.xls,.csv" label="Drop the Winnings coverage schedule (Postcode + Zone columns, optional Suburb)" onFile={uploadZones} busy={busy === 'zones'} />
            )}
            {err?.kind === 'zones' && <div className="note err">{err.msg}</div>}
            <div className="toolbar">
              <button className="btn sm" onClick={() => downloadJson('winnings-zones.json', zones)}>
                Download winnings-zones.json
              </button>
              {data.zones.local && (
                <button
                  className="btn sm"
                  onClick={() => {
                    setLocal('zones', null);
                    onToast('Back to the published zones');
                  }}
                >
                  Reset to published
                </button>
              )}
            </div>
            <p className="small faint" style={{ margin: 0 }}>
              Suburb list: {data.postcodes.source}. Remoteness: ABS Australian Statistical Geography Standard (CC BY 4.0).
            </p>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Publishing an update for everyone</h2>
        </div>
        <div className="card-body">
          <p style={{ marginTop: 0 }}>
            Uploads and rate edits on this page are saved in <b>your browser only</b>, so you can quote a new product straight away. To update the calculator for the whole team:
          </p>
          <ol className="steps">
            <li>
              <b>Easiest:</b> give the new master data workbook, rate card PDF or fuel levy notice to Claude Code in this repository and ask it to “update the freight calculator”. It runs the import, checks
              the numbers and publishes.
            </li>
            <li>
              <b>By hand:</b> use the Download buttons above, then replace the matching file in <code>_src/revel-freight-calculator/public/data/</code> on GitHub. The site rebuilds when the change reaches{' '}
              <code>main</code>.
            </li>
          </ol>
          <p className="small muted" style={{ marginBottom: 0 }}>
            This site is public. Never commit the raw master data workbook: it holds cost and supplier data. The import keeps only freight fields.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Master data check</h2>
          <span className="small muted">Fix these in the workbook for accurate freight.</span>
        </div>
        <div className="filters" style={{ borderBottom: '1px solid var(--line)' }}>
          <div className="chips">
            {(
              [
                ['all', 'All issues'],
                ['cbm', `CBM ≠ dimensions (${counts.cbm})`],
                ['missing', `Missing cartons (${counts.missing})`],
                ['desc', `No description (${counts.desc})`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className="chip" aria-pressed={issueFilter === id} onClick={() => setIssueFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 520 }}>
          <table className="grid">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hide-sm">Category</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((p) => (
                <tr key={p.sku}>
                  <td>
                    <div className="pname">{p.name === p.sku ? <span className="muted">No description</span> : p.name}</div>
                    <div className="psku">{p.sku}</div>
                  </td>
                  <td className="hide-sm muted">{titleCase(p.category)}</td>
                  <td>
                    <ul style={{ margin: 0, paddingLeft: 16 }} className="small">
                      {p.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!issues.length && <div className="empty">No issues in this group.</div>}
        </div>
      </section>
    </div>
  );
}
