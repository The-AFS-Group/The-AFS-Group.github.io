import { useCallback, useEffect, useState } from 'react';
import type { DfeRateCard, PostcodesFile, ProductsFile, RateCard, WebsiteFile, ZoneScheduleFile } from './types';

/**
 * Published data lives in public/data/*.json and is the same for everyone.
 * Uploads and rate edits made on the Data / Rates tabs are saved in this
 * browser only (localStorage) and take priority until reset.
 */

const BASE = import.meta.env.BASE_URL;
const KEYS = { products: 'rfc.products.v1', rateCard: 'rfc.rateCard.v1', zones: 'rfc.zones.v1', dfe: 'rfc.dfe.v1', prefs: 'rfc.prefs.v1' } as const;

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}data/${file}?v=${Math.floor(Date.now() / 300000)}`);
  if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
  return res.json();
}

export interface Dataset<T> {
  published: T;
  local: T | null;
  active: T;
}

export interface AppData {
  products: Dataset<ProductsFile>;
  rateCard: Dataset<RateCard>;
  zones: Dataset<ZoneScheduleFile>;
  dfe: Dataset<DfeRateCard>;
  postcodes: PostcodesFile;
  /** revelsaunas.com.au catalogue snapshot; null if the file is missing. */
  website: WebsiteFile | null;
}

type Kind = 'products' | 'rateCard' | 'zones' | 'dfe';

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getJson<ProductsFile>('products.json'),
      getJson<RateCard>('winnings-rate-card.json'),
      getJson<ZoneScheduleFile>('winnings-zones.json'),
      getJson<PostcodesFile>('postcodes.json'),
      getJson<WebsiteFile>('website.json').catch(() => null),
      getJson<DfeRateCard>('dfe-rate-card.json'),
    ])
      .then(([products, rateCard, zones, postcodes, website, dfe]) => {
        const ds = <T,>(published: T, key: string): Dataset<T> => {
          const local = readLocal<T>(key);
          return { published, local, active: local ?? published };
        };
        const localCard = readLocal<RateCard>(KEYS.rateCard);
        setData({
          products: ds(products, KEYS.products),
          // Fill any fields a newer published card added since the local copy was saved.
          rateCard: localCard
            ? { published: rateCard, local: localCard, active: { ...rateCard, ...localCard, rules: { ...rateCard.rules, ...localCard.rules } } }
            : { published: rateCard, local: null, active: rateCard },
          zones: ds(zones, KEYS.zones),
          dfe: ds(dfe, KEYS.dfe),
          postcodes,
          website,
        });
      })
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  const setLocal = useCallback(<K extends Kind>(kind: K, value: AppData[K]['published'] | null): boolean => {
    const saved = writeLocal(KEYS[kind], value);
    setData((d) => (d ? { ...d, [kind]: { ...d[kind], local: value, active: value ?? d[kind].published } } : d));
    return saved;
  }, []);

  return { data, error, setLocal };
}

export interface Prefs {
  origin?: string;
  lifecycles?: string[];
}

export const loadPrefs = () => readLocal<Prefs>(KEYS.prefs) ?? {};
export const savePrefs = (p: Prefs) => writeLocal(KEYS.prefs, p);

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads the first sheet (or a chosen one) of an uploaded .xlsx / .csv as rows. xlsx is loaded on demand. */
export async function readSpreadsheet(file: File): Promise<{ sheetNames: string[]; rowsOf: (name: string) => any[][] }> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const cache = new Map<string, any[][]>();
  return {
    sheetNames: wb.SheetNames,
    rowsOf: (name: string) => {
      if (!cache.has(name)) cache.set(name, XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true, defval: null }));
      return cache.get(name)!;
    },
  };
}
