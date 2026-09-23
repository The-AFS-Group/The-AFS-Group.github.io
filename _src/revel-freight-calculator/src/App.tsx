import { useEffect, useMemo, useState } from 'react';
import DestinationBar from './components/DestinationBar';
import ProductTable from './components/ProductTable';
import QuotePanel from './components/QuotePanel';
import RatesTab from './components/RatesTab';
import DataTab from './components/DataTab';
import { quote, type QuoteLine, type QuoteOptions, type Service } from './lib/freight';
import { buildDestination, lookupPostcode, scheduleZone } from './lib/zones';
import { loadPrefs, savePrefs, useAppData } from './lib/store';
import { MATRIX_STATES, type MatrixState, type Product } from './lib/types';
import { aud, pct } from './lib/format';

type Tab = 'calc' | 'rates' | 'data';

export default function App() {
  const { data, error, setLocal } = useAppData();
  const [tab, setTab] = useState<Tab>('calc');
  const [postcode, setPostcode] = useState('');
  const [locality, setLocality] = useState('');
  const [manualZone, setManualZone] = useState<number | null>(null);
  const [origin, setOrigin] = useState<MatrixState | null>(null);
  const [service, setService] = useState<Service>('delivery');
  const [install, setInstall] = useState(false);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [quoteVisible, setQuoteVisible] = useState(true);

  const card = data?.rateCard.active;
  const products = useMemo(() => data?.products.active.products ?? [], [data]);

  useEffect(() => {
    if (!card || origin) return;
    const saved = loadPrefs().origin as MatrixState | undefined;
    setOrigin(saved && (MATRIX_STATES as readonly string[]).includes(saved) ? saved : card.rules.defaultOrigin);
  }, [card, origin]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Keep quote lines pointing at the current product data after an upload or reset.
  useEffect(() => {
    const bySku = new Map(products.map((p) => [p.sku, p]));
    setLines((ls) => {
      if (!ls.some((l) => bySku.has(l.product.sku) && bySku.get(l.product.sku) !== l.product)) return ls;
      return ls.map((l) => ({ ...l, product: bySku.get(l.product.sku) ?? l.product }));
    });
  }, [products]);

  // Mobile: show a pinned summary when the quote panel is scrolled out of view.
  useEffect(() => {
    const el = document.querySelector('aside.quote');
    if (!el || tab !== 'calc') return;
    const io = new IntersectionObserver(([e]) => setQuoteVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, data, origin]);

  const match = useMemo(() => (data ? lookupPostcode(postcode, data.postcodes) : null), [postcode, data]);

  const defaultLocality = useMemo(() => {
    if (!match || !data) return '';
    const deliverable = match.localities.filter((l) => l.deliverable);
    const pool = deliverable.length ? deliverable : match.localities;
    const zoneOf = (l: (typeof pool)[number]) => scheduleZone(data.zones.active, match.postcode, l.name) ?? l.zone;
    const counts = new Map<number, number>();
    pool.forEach((l) => counts.set(zoneOf(l), (counts.get(zoneOf(l)) || 0) + 1));
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return (pool.find((l) => zoneOf(l) === common) ?? pool[0]).name;
  }, [match, data]);

  const dest = useMemo(
    () => (match && data ? buildDestination(match, locality || defaultLocality, data.zones.active, manualZone) : null),
    [match, data, locality, defaultLocality, manualZone],
  );

  const opts: QuoteOptions = { origin: origin ?? 'NSW', service, install };
  const result = useMemo(() => (card ? quote(lines, dest, opts, card) : null), [lines, dest, card, opts.origin, opts.service, opts.install]);

  if (error) return <div className="loading">Could not load the calculator data: {error}</div>;
  if (!data || !card || !origin) return <div className="loading">Loading rates and products…</div>;

  const addProduct = (p: Product) => {
    setLines((ls) => (ls.some((l) => l.product.sku === p.sku) ? ls : [...ls, { id: p.sku, product: p, qty: 1 }]));
  };

  const changePostcode = (v: string) => {
    setPostcode(v);
    setLocality('');
    setManualZone(null);
  };

  const changeOrigin = (o: MatrixState) => {
    setOrigin(o);
    savePrefs({ ...loadPrefs(), origin: o });
  };

  const anyLocal = !!(data.products.local || data.rateCard.local || data.zones.local);
  const fuel = card.fuelLevy;

  return (
    <>
      <header className="topbar">
        {logoFailed ? (
          <span className="wordmark">REVEL</span>
        ) : (
          <img src="https://revelsaunas.com.au/cdn/shop/files/REVEL_Logo-White.svg?v=1746587610&width=140" alt="Revel" onError={() => setLogoFailed(true)} />
        )}
        <div className="title">
          <h1>Freight Calculator</h1>
          <span className="sub">{card.carrier} 3PL · rates ex GST</span>
        </div>
        <div className="right">
          <span className="pill">
            Fuel levy <b>{pct(fuel.pct)}</b> {fuel.period}
          </span>
          <span className="pill">
            <b>{products.filter((p) => p.status === 'ok').length}</b> products priced
          </span>
          {anyLocal && (
            <button className="pill local" style={{ background: 'none', cursor: 'pointer' }} onClick={() => setTab('data')}>
              Using data saved in this browser
            </button>
          )}
        </div>
      </header>
      <nav className="tabs" role="tablist">
        {(
          [
            ['calc', 'Calculator'],
            ['rates', 'Rates & rules'],
            ['data', 'Data & uploads'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'calc' && (
          <>
            <DestinationBar
              postcode={postcode}
              onPostcode={changePostcode}
              match={match}
              dest={dest}
              locality={locality || defaultLocality}
              onLocality={(l) => {
                setLocality(l);
                setManualZone(null);
              }}
              manualZone={manualZone}
              onManualZone={setManualZone}
              origin={origin}
              onOrigin={changeOrigin}
              service={service}
              onService={setService}
              install={install}
              onInstall={setInstall}
              card={card}
              schedule={data.zones.active}
            />
            <div className="calc">
              {/* The list shows freight only; install is added in the quote panel. */}
              <ProductTable products={products} dest={dest} opts={{ ...opts, install: false }} card={card} inQuote={new Set(lines.map((l) => l.product.sku))} onAdd={addProduct} />
              <QuotePanel
                lines={lines}
                setLines={setLines}
                result={result}
                dest={dest}
                opts={opts}
                card={card}
                onToast={setToast}
              />
            </div>
          </>
        )}
        {tab === 'rates' && <RatesTab rateCard={data.rateCard} onSave={(c) => setLocal('rateCard', c)} onToast={setToast} />}
        {tab === 'data' && <DataTab data={data} setLocal={setLocal} onToast={setToast} />}
      </main>
      {tab === 'calc' && lines.length > 0 && !quoteVisible && (
        <button className="mobile-sum" onClick={() => document.querySelector('aside.quote')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span>
            Quote · {lines.reduce((s, l) => s + l.qty, 0)} unit{lines.reduce((s, l) => s + l.qty, 0) === 1 ? '' : 's'}
            {!result?.ok && <span style={{ opacity: 0.75 }}> · {result?.error ?? 'enter a postcode'}</span>}
          </span>
          {result?.ok && <b>{aud(result.incGst)}</b>}
        </button>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
