import { useMemo, useState } from 'react';
import { productCbm, quote, type Destination, type QuoteOptions, type QuoteResult } from '../lib/freight';
import type { Product, RateCard, SizeClassId, WebsiteFile } from '../lib/types';
import { aud, cbm as fmtCbm, titleCase } from '../lib/format';
import { loadPrefs, savePrefs } from '../lib/store';

interface Props {
  products: Product[];
  dest: Destination | null;
  opts: QuoteOptions;
  card: RateCard;
  inQuote: Set<string>;
  onAdd: (p: Product) => void;
  website: WebsiteFile | null;
  carrier: 'winnings' | 'dfe';
  dfeReady: boolean;
}

type SortKey = 'name' | 'category' | 'cbm' | 'freight';
const LIFECYCLES = ['Current', 'New', 'Disco', 'Obsolete'];
const PAGE = 60;

export function SizeBadges({ result, card }: { result: QuoteResult | null; card: RateCard }) {
  if (!result?.items.length) return null;
  const counts = new Map<SizeClassId, number>();
  result.items.forEach((i) => counts.set(i.sizeClass.id, (counts.get(i.sizeClass.id) || 0) + 1));
  const order = [...card.sizeClasses].sort((a, b) => (b.maxKg ?? Infinity) - (a.maxKg ?? Infinity));
  return (
    <span className="classes">
      {order
        .filter((c) => counts.has(c.id))
        .map((c) => (
          <span key={c.id} className={`sc sc-${c.id}`} title={`${counts.get(c.id)} × ${c.label}`}>
            {(counts.get(c.id) || 0) > 1 ? `${counts.get(c.id)}× ` : ''}
            {c.label}
          </span>
        ))}
    </span>
  );
}

export default function ProductTable({ products, dest, opts, card, inQuote, onAdd, website, carrier, dfeReady }: Props) {
  const web = (p: Product) => website?.products[p.sku.toUpperCase()];
  const [onSite, setOnSite] = useState<'' | 'yes' | 'no'>('');
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [lifecycles, setLifecycles] = useState<string[]>(() => loadPrefs().lifecycles ?? ['Current', 'New']);
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [limit, setLimit] = useState(PAGE);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);
  const categories = useMemo(
    () => [...new Set(products.filter((p) => p.status !== 'service').map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  // One single-unit quote per product for the "Freight" column.
  const priced = useMemo(() => {
    const m = new Map<string, QuoteResult>();
    for (const p of products) {
      if (p.status !== 'ok') continue;
      m.set(p.sku, quote([{ id: p.sku, product: p, qty: 1 }], dest, opts, card));
    }
    return m;
  }, [products, dest, opts.origin, opts.service, card]);

  const toggleLifecycle = (l: string) => {
    const next = lifecycles.includes(l) ? lifecycles.filter((x) => x !== l) : [...lifecycles, l];
    setLifecycles(next);
    savePrefs({ ...loadPrefs(), lifecycles: next });
    setLimit(PAGE);
  };

  const needle = q.trim().toLowerCase();
  const base = products.filter(
    (p) =>
      (!brand || p.brand === brand) &&
      (!category || p.category === category) &&
      (!lifecycles.length || lifecycles.includes(p.lifecycle)) &&
      (!onSite || (onSite === 'yes') === !!web(p)) &&
      (!needle || `${p.sku} ${p.name} ${p.category} ${p.subCategory}`.toLowerCase().includes(needle)),
  );
  const hiddenUnpriced = base.filter((p) => p.status !== 'ok').length;
  const rows = (showUnpriced ? base : base.filter((p) => p.status === 'ok')).slice();

  const freightOf = (p: Product) => {
    const r = priced.get(p.sku);
    return r?.ok ? r.incGst : Infinity;
  };
  rows.sort((a, b) => {
    const d = sort.dir;
    switch (sort.key) {
      case 'category':
        return d * (a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      case 'cbm':
        return d * (productCbm(a, card.rules) - productCbm(b, card.rules));
      case 'freight':
        return d * (freightOf(a) - freightOf(b)) || a.name.localeCompare(b.name);
      default:
        return d * a.name.localeCompare(b.name);
    }
  });

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'freight' || key === 'cbm' ? -1 : 1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );

  const delivery = opts.service === 'delivery';
  const canPrice = !delivery || !!dest;

  return (
    <section className="card products" aria-label="Products">
      <div className="filters">
        <label className="field search">
          <span className="label">Search</span>
          <input
            className="input"
            type="search"
            placeholder="Product name or SKU, e.g. Tampere, R-TR-2P"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <label className="field">
          <span className="label">Category</span>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Brand</span>
          <select className="select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        {website && (
          <label className="field">
            <span className="label">Website</span>
            <select className="select" value={onSite} onChange={(e) => setOnSite(e.target.value as '' | 'yes' | 'no')}>
              <option value="">All products</option>
              <option value="yes">On revelsaunas.com.au</option>
              <option value="no">Not on the website</option>
            </select>
          </label>
        )}
        <div className="field">
          <span className="label">Lifecycle</span>
          <div className="chips">
            {LIFECYCLES.filter((l) => products.some((p) => p.lifecycle === l)).map((l) => (
              <button key={l} className="chip" aria-pressed={lifecycles.includes(l)} onClick={() => toggleLifecycle(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="resultbar">
        <span>
          <b className="num">{rows.length}</b> product{rows.length === 1 ? '' : 's'}
          {canPrice ? (delivery ? ` · freight to ${dest!.postcode} ${dest!.locality}, 1 unit` : ' · warehouse collection, 1 unit') : ''}
        </span>
        {hiddenUnpriced > 0 && (
          <label className="check aside small">
            <input type="checkbox" checked={showUnpriced} onChange={(e) => setShowUnpriced(e.target.checked)} />
            Show {hiddenUnpriced} without carton data or services
          </label>
        )}
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {th('name', 'Product')}
              {th('category', 'Category', 'hide-sm')}
              <th className="r hide-sm">Cartons</th>
              {th('cbm', 'CBM', 'r hide-sm')}
              <th className="hide-sm">Size</th>
              {th('freight', canPrice ? 'Freight inc GST' : 'Freight', 'r')}
              <th className="r">
                <span className="sr-only">Add to quote</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => {
              const r = priced.get(p.sku) ?? null;
              const w = web(p);
              const added = inQuote.has(p.sku);
              const ok = p.status === 'ok';
              return (
                <tr
                  key={p.sku}
                  className={`row ${added ? 'in' : ''} ${ok ? '' : 'dim'}`}
                  tabIndex={0}
                  onClick={() => ok && onAdd(p)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && ok) {
                      e.preventDefault();
                      onAdd(p);
                    }
                  }}
                >
                  <td>
                    <div className="pcell">
                      {website && (w?.image ? <img className="thumb" src={w.image} alt="" loading="lazy" /> : <span className="thumb" aria-hidden />)}
                      <div style={{ minWidth: 0 }}>
                        <div className="pname">{p.name}</div>
                        <div className="psku">
                          {p.sku}
                          {p.lifecycle !== 'Current' && <span className="tag" style={{ marginLeft: 6 }}>{p.lifecycle}</span>}
                          {w && (
                            <a className="weblink" href={w.url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title="Open on revelsaunas.com.au">
                              {aud(w.price)} on site ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hide-sm muted">{titleCase(p.category)}</td>
                  <td className="r hide-sm num">{p.cartons.length || '–'}</td>
                  <td className="r hide-sm num nowrap">{p.cartons.length ? fmtCbm(productCbm(p, card.rules)) : '–'}</td>
                  <td className="hide-sm">
                    {ok ? <SizeBadges result={r} card={card} /> : <span className="tag warn">{p.status === 'service' ? 'Service' : 'No carton data'}</span>}
                  </td>
                  <td className="r nowrap">
                    {!ok ? (
                      <span className="faint">–</span>
                    ) : carrier === 'dfe' && !dfeReady ? (
                      <span className="faint small" title="Send DFE's base freight rates to price DFE deliveries">DFE base rates needed</span>
                    ) : !canPrice ? (
                      <span className="faint small">Enter postcode</span>
                    ) : r?.ok ? (
                      <>
                        <div className="price num">{aud(r.incGst)}</div>
                        <div className="faint small num">{aud(r.exGst)} ex</div>
                      </>
                    ) : (
                      <span className="faint small">{r?.error ?? '–'}</span>
                    )}
                  </td>
                  <td className="r">
                    {ok && (
                      <button
                        className={`add-btn ${added ? 'done' : ''}`}
                        aria-label={added ? `${p.name} is in the quote` : `Add ${p.name} to quote`}
                        title={added ? 'In quote' : 'Add to quote'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdd(p);
                        }}
                      >
                        {added ? '✓' : '+'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty">No products match these filters.</div>}
        {rows.length > limit && (
          <div className="empty" style={{ padding: 16 }}>
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({rows.length - limit} remaining)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
