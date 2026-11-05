// BFCM tab data. Mirrors the Revel Master Dashboard BFCM tab, wired to GAF sources:
//  - GAF DATA tab (same sheet as Sales Health), every row incl. today's partial row and future budget rows
//  - GAF performance feed (gaf-performance-data.json): HubSpot list growth, Shopify products, Meta creative, IG posts
//  - GAF IG feed tab (adds views/reach to posts the feed already has)

const GAF_DATA_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=0&single=true&output=csv";
const GAF_IG_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vT72MxE6-ziV7qfKCkHXatwJC47qjSAm0Fv0553yd09v3b0fLo-9QI3VZ-ehF_qjpaDNdd9jrYwDbU6/pub?gid=413441331&single=true&output=csv";
// Daily JSON behind the GAF Performance Dashboard (Meta, Google, GA4, HubSpot, Shopify). Rebuilt every morning.
const GAF_PERF_JSON = "https://gaf-perf-dashboard.pages.dev/gaf-performance-data.json";

const CACHE_TTL_MS = 15 * 60 * 1000;

// ---------- Types ----------

export interface BfcmDay {
  date: string; // "Nov 4"
  fullDate: string; // YYYY-MM-DD
  grossProfitCreated: number;
  grossMarginCreated: number;
  grossProfitFulfilled: number;
  grossMarginFulfilled: number;
  salesDiscountFulfilled: number; // column N: sales discount % on created orders
  sessions: number;
  inboundSalesCalls: number;
}

export interface BfcmBudget {
  fullDate: string;
  grossProfitCreatedBudget: number;
  grossProfitFulfilledBudget: number;
  targetSessions: number;
}

export interface BfcmDaily {
  allData: BfcmDay[];
  allBudgetData: BfcmBudget[];
  fetchedAt: number;
}

export interface BfcmPost {
  thumbnailUrl: string;
  permalink: string;
  caption: string;
  totalInteractions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  publishedAt?: string;
}

export interface LeadDay {
  date: string;
  listSize: number;
  newLeads: number;
}

export interface PerfProduct {
  handle: string;
  title: string;
  sessions: number;
  atc: number;
  orders: number;
  revenue: number;
  cvr: number;
}

export interface AdCreative {
  adId: string;
  adName: string;
  campaign: string;
  body: string;
  thumbnailUrl: string;
  previewLink: string;
  spend: number;
  impressions: number;
  clicks: number;
  outboundClicks: number;
  ctr: number;
  purchases: number;
  addToCart: number;
  engagements: number;
}

export interface GafPerformanceFeed {
  generatedAt: string;
  leadListName: string;
  leads: LeadDay[];
  products7d: PerfProduct[];
  products30d: PerfProduct[];
  productsThrough: string;
  adCreative7d: AdCreative[];
  igPosts: BfcmPost[];
}

// ---------- Helpers ----------

export const getBfcmCache = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(`bfcm_gaf_${key}`);
    return raw ? (JSON.parse(raw).v as T) : null;
  } catch {
    return null;
  }
};

const isStale = (key: string): boolean => {
  try {
    const raw = localStorage.getItem(`bfcm_gaf_${key}`);
    return !raw || Date.now() - JSON.parse(raw).t > CACHE_TTL_MS;
  } catch {
    return true;
  }
};

const setCache = (key: string, v: unknown) => {
  try {
    localStorage.setItem(`bfcm_gaf_${key}`, JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* storage full or blocked: carry on without a cache */
  }
};

const safeFetch = async (url: string, options?: RequestInit, timeoutMs = 60000): Promise<string> => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      console.warn(`BFCM fetch failed for ${url}: ${res.status}`);
      return "";
    }
    return await res.text();
  } catch (e) {
    console.warn(`BFCM network error for ${url}`, e);
    return "";
  }
};

/**
 * Google's publish-to-web CSVs answer either in about a second or after 50-90 seconds, at random
 * (measured 5 Nov 2026; the GAF DATA tab took 80s on one call). A single request with a 60s
 * timeout therefore often comes back empty and the tab looks frozen. Instead, race staggered
 * copies of the request: start one, add another every `staggerMs` while nothing has answered,
 * and take the first valid response (the rest are aborted). If every copy fails, return "".
 * Same approach as the Revel Master Dashboard BFCM tab.
 */
const hedgedFetch = (
  url: string,
  options: RequestInit = {},
  {
    attempts = 5,
    staggerMs = 6000,
    timeoutMs = 150000,
    isValid = (text: string) => text.trim().length > 0,
  }: { attempts?: number; staggerMs?: number; timeoutMs?: number; isValid?: (text: string) => boolean } = {}
): Promise<string> =>
  new Promise<string>((resolve) => {
    const controllers: AbortController[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let settled = false;
    let started = 0;
    let failed = 0;

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      controllers.forEach((c) => c.abort());
      if (!text) console.warn(`BFCM: no usable response from ${url} after ${started} attempts`);
      resolve(text);
    };

    const launch = () => {
      if (settled || started >= attempts) return;
      started++;
      const controller = new AbortController();
      controllers.push(controller);
      const sep = url.includes("?") ? "&" : "?";
      // A unique URL per copy, so the browser can't fold the copies into one request
      fetch(`${url}${sep}_ts=${Date.now()}-${started}`, { ...options, cache: "no-store", signal: controller.signal })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((text) => {
          if (!isValid(text)) throw new Error("unusable response");
          finish(text);
        })
        .catch(() => {
          if (settled) return;
          failed++;
          if (failed >= attempts) finish("");
          else if (failed === started) launch(); // everything in flight has failed: don't wait for the stagger
        });
    };

    launch();
    for (let n = 1; n < attempts; n++) timers.push(setTimeout(launch, staggerMs * n));
    timers.push(setTimeout(() => finish(""), timeoutMs));
  });

// The GAF DATA tab starts with its header row; anything else (an HTML error page) is a failure
const looksLikeDailyData = (text: string) => /^\s*"?DATE"?,/i.test(text);

const parseCSVRaw = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') { field += '"'; i++; } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      row.push(field); field = "";
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
};

const clean = (s: string | undefined) => (s ? s.replace(/[$,%\s‎‏]/g, "").trim() : "0");
const f = (s: string | undefined) => parseFloat(clean(s)) || 0;
const i = (s: string | undefined) => parseInt(clean(s)) || 0;
const num = (v: any): number => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isFinite(n) ? n : 0;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseRowDate = (s: string): Date | null => {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const [y, m, d] = t.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const p = t.split(" ")[0].split("/");
  if (p.length === 3) {
    let y = parseInt(p[2]);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(p[1]) - 1, parseInt(p[0]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
};

// ---------- Fetchers ----------

/**
 * The GAF DATA tab, every row (including today's partial row and future budget-only rows).
 * Columns: A date, B GP created, C GM created, D GP created budget, E GP fulfilled, F GM fulfilled,
 * G GP fulfilled budget, H sessions, I target sessions, ... L inbound sales calls, N sales discount.
 */
export const fetchGafDailyData = async (): Promise<BfcmDaily> => {
  const csv = await hedgedFetch(GAF_DATA_CSV, { priority: "high" } as RequestInit, { isValid: looksLikeDailyData });
  const rows = parseCSVRaw(csv);
  const allData: BfcmDay[] = [];
  const allBudgetData: BfcmBudget[] = [];
  const h = rows.findIndex((r) => r[0]?.trim().toUpperCase() === "DATE");
  if (h >= 0) {
    for (const c of rows.slice(h + 1)) {
      if (!c[0]?.trim()) continue;
      const d = parseRowDate(c[0]);
      if (!d) continue;
      const fullDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      allBudgetData.push({
        fullDate,
        grossProfitCreatedBudget: f(c[3]),
        grossProfitFulfilledBudget: f(c[6]),
        targetSessions: i(c[8]),
      });
      allData.push({
        date: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
        fullDate,
        grossProfitCreated: f(c[1]),
        grossMarginCreated: f(c[2]),
        grossProfitFulfilled: f(c[4]),
        grossMarginFulfilled: f(c[5]),
        sessions: i(c[7]),
        inboundSalesCalls: i(c[11]),
        salesDiscountFulfilled: f(c[13]),
      });
    }
  }
  const result = { allData, allBudgetData, fetchedAt: Date.now() };
  if (allData.length > 0) setCache("daily", result);
  return result;
};

/** Every post on the GAF IG FEED tab published in the last `days` days (all media types). */
export const fetchGafRecentInstagramPosts = async (days = 7, force = false): Promise<BfcmPost[]> => {
  const key = `ig_${days}`;
  if (!force && !isStale(key)) {
    const c = getBfcmCache<BfcmPost[]>(key);
    if (c) return c;
  }
  const csv = await safeFetch(GAF_IG_CSV);
  if (!csv) return [];
  const rows = parseCSVRaw(csv);
  let hi = -1;
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const s = rows[r].join(" ").toLowerCase();
    if (s.includes("caption") && (s.includes("thumbnail") || s.includes("permalink") || s.includes("comments"))) { hi = r; break; }
  }
  if (hi === -1) return [];
  const headers = rows[hi].map((x) => x.trim().toLowerCase());
  const col = (...keys: string[]) => {
    for (const k of keys) { const ix = headers.indexOf(k.toLowerCase()); if (ix !== -1) return ix; }
    return -1;
  };
  const ix = {
    date: col("publish date", "date"), caption: col("caption"),
    thumb: col("media thumbnail url", "thumbnail url", "media url", "image url", "picture"),
    comments: col("comments"), likes: col("likes"), permalink: col("permalink", "link"),
    reach: col("reach"), shares: col("shares"), total: col("total interactions"), views: col("views", "impressions"),
  };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const posts: BfcmPost[] = [];
  for (const r of rows.slice(hi + 1)) {
    const g = (k: number) => (k !== -1 && r[k] ? r[k].trim() : "");
    const ds = g(ix.date);
    if (!ds) continue;
    let d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(ds) ? ds.replace(" ", "T") : ds);
    if (isNaN(d.getTime())) d = parseRowDate(ds) || new Date(NaN);
    if (isNaN(d.getTime()) || d < cutoff) continue;
    const likes = i(g(ix.likes));
    const comments = i(g(ix.comments));
    posts.push({
      caption: g(ix.caption),
      likes,
      comments,
      thumbnailUrl: g(ix.thumb),
      permalink: g(ix.permalink),
      reach: i(g(ix.reach)),
      shares: i(g(ix.shares)),
      totalInteractions: i(g(ix.total)) || likes + comments,
      views: i(g(ix.views)),
      publishedAt: d.toISOString(),
    });
  }
  setCache(key, posts);
  return posts;
};

const toPerfProducts = (rows: any): PerfProduct[] =>
  Array.isArray(rows)
    ? rows.map((r: any) => ({
        handle: String(r.handle || ""),
        title: String(r.title || r.handle || "Unknown product"),
        sessions: num(r.sessions),
        atc: num(r.atc),
        orders: num(r.orders),
        revenue: num(r.revenue),
        cvr: num(r.cvr),
      }))
    : [];

/**
 * Pulls the parts of the GAF performance feed the BFCM view needs: HubSpot list growth (leads),
 * Shopify product sales for 7d / 30d, Meta ad creative for 7d and organic Instagram posts.
 */
export const fetchGafPerformanceFeed = async (force = false): Promise<GafPerformanceFeed | null> => {
  const key = "perf_feed";
  if (!force && !isStale(key)) {
    const c = getBfcmCache<GafPerformanceFeed>(key);
    if (c) return c;
  }
  const text = await safeFetch(`${GAF_PERF_JSON}?_ts=${Date.now()}`, { cache: "no-store" });
  if (!text) return getBfcmCache<GafPerformanceFeed>(key);
  try {
    const d = JSON.parse(text);
    const list = d?.hubspot?.["30d"]?.list || d?.hubspot?.["7d"]?.list || d?.hubspot?.yesterday?.list || {};
    const history: { date: string; size: number }[] = (Array.isArray(list.history) ? list.history : [])
      .map((h: any) => ({ date: String(h.date || "").slice(0, 10), size: num(h.size) }))
      .filter((h: { date: string; size: number }) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.size > 0)
      .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    const leads: LeadDay[] = history
      .map((h, idx) => ({ date: h.date, listSize: h.size, newLeads: idx === 0 ? 0 : h.size - history[idx - 1].size }))
      .slice(1);

    const creative: AdCreative[] = (Array.isArray(d?.meta?.["7d"]?.creative) ? d.meta["7d"].creative : []).map((c: any) => ({
      adId: String(c.adId || ""),
      adName: String(c.adName || ""),
      campaign: String(c.campaign || ""),
      body: String(c.body || c.title || ""),
      thumbnailUrl: String(c.thumbnailUrl || c.imageUrl || ""),
      previewLink: String(c.previewLink || ""),
      spend: num(c.spend),
      impressions: num(c.impressions),
      clicks: num(c.clicks),
      outboundClicks: num(c.outboundClicks),
      ctr: num(c.ctr),
      purchases: num(c.purchases),
      addToCart: num(c.addToCart),
      engagements: num(c.engagements),
    }));

    const igPosts: BfcmPost[] = (Array.isArray(d?.organic?.ig?.posts) ? d.organic.ig.posts : []).map((p: any) => {
      const likes = num(p.likes);
      const comments = num(p.comments);
      const ts = p.timestamp ? new Date(String(p.timestamp).replace(/([+-]\d{2})(\d{2})$/, "$1:$2")) : null;
      return {
        thumbnailUrl: String(p.thumbnail || p.thumbnailUrl || ""),
        permalink: String(p.permalink || ""),
        caption: String(p.caption || ""),
        totalInteractions: likes + comments,
        views: 0,
        likes,
        comments,
        shares: num(p.shares),
        reach: 0,
        publishedAt: ts && !isNaN(ts.getTime()) ? ts.toISOString() : undefined,
      };
    });

    const result: GafPerformanceFeed = {
      generatedAt: String(d?.generated_at || ""),
      leadListName: String(list.name || "HubSpot list"),
      leads,
      products7d: toPerfProducts(d?.products?.["7d"]),
      products30d: toPerfProducts(d?.products?.["30d"]),
      productsThrough: String(d?.sales?.["7d"]?.dataThrough || d?.shopify?.["7d"]?.dataThrough || ""),
      adCreative7d: creative,
      igPosts,
    };
    setCache(key, result);
    return result;
  } catch (e) {
    console.error("BFCM: GAF performance feed parse error", e);
    return getBfcmCache<GafPerformanceFeed>(key);
  }
};
