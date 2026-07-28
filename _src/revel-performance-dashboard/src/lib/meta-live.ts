/**
 * meta-live.ts
 *
 * Live Meta Ads KPI refresh via the Cloudflare Worker proxy.
 * The Worker (meta-api-proxy.josh-03c.workers.dev) holds the real Meta
 * access token server-side and injects it when it proxies the request.
 * This client sends the sentinel value "proxied" for access_token — no
 * real token ever lives in this file or in the browser.
 */

import type { Window } from "./data";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_BASE = "https://meta-api-proxy.josh-03c.workers.dev/v21.0";
const GAF_ACCOUNT = "act_2412898282250572";   // Revel
/** Sentinel forwarded to the Worker; the Worker substitutes the real token. */
const PROXY_TOKEN = "proxied";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetaLiveKpis {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  convValue: number;
  roas: number;
  cpm: number;
}

export interface MetaLiveResult {
  kpis: MetaLiveKpis;
  fetchedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Today's date in Australia/Adelaide as a Date at UTC midnight. */
function adelaideToday(): Date {
  // en-CA locale formats as YYYY-MM-DD
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Adelaide" });
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Map the dashboard Window slug to a { since, until } date pair.
 *
 * Anchored to Australia/Adelaide and ending YESTERDAY, matching the nightly
 * snapshot's windows — otherwise a live refresh silently swaps in a
 * different date range (UTC, including today) and the numbers jump.
 */
function windowToDates(win: Window): { since: string; until: string } {
  const today = adelaideToday();
  const pad = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };
  if (win === "mtd") {
    // Month to date, anchored to yesterday's month (Adelaide)
    const anchor = daysAgo(1);
    const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    return { since: pad(first), until: pad(anchor) };
  }
  if (win === "lastMonth") {
    // Previous calendar month (Adelaide-anchored)
    const firstOfThis = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const lastOfPrev = new Date(firstOfThis);
    lastOfPrev.setUTCDate(0);
    const firstOfPrev = new Date(Date.UTC(lastOfPrev.getUTCFullYear(), lastOfPrev.getUTCMonth(), 1));
    return { since: pad(firstOfPrev), until: pad(lastOfPrev) };
  }
  const spans: Record<string, number> = { yesterday: 1, "7d": 7, "30d": 30, "90d": 90 };
  const span = spans[win] ?? 30;
  return { since: pad(daysAgo(span)), until: pad(daysAgo(1)) };
}

/** Sum the value of a given action_type from an actions / action_values list. */
function actionValue(
  items: Array<{ action_type: string; value: string | number }> | undefined,
  actionType: string
): number {
  if (!items) return 0;
  let total = 0;
  for (const item of items) {
    if (item.action_type === actionType) {
      total += parseFloat(String(item.value ?? 0)) || 0;
    }
  }
  return total;
}

interface InsightRow {
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  actions?: Array<{ action_type: string; value: string | number }>;
  action_values?: Array<{ action_type: string; value: string | number }>;
}

/** Derive the KPI object from a list of insight rows (mirrors meta.py logic). */
function insightsToKpis(rows: InsightRow[]): MetaLiveKpis {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let convValue = 0;

  for (const row of rows) {
    spend += parseFloat(String(row.spend ?? 0)) || 0;
    impressions += parseInt(String(row.impressions ?? 0), 10) || 0;
    clicks += parseInt(String(row.clicks ?? 0), 10) || 0;
    conversions += actionValue(row.actions, "purchase");
    convValue += actionValue(row.action_values, "purchase");
  }

  const ctr = impressions > 0 ? Math.round((clicks / impressions) * 100 * 100) / 100 : 0;
  const roas = spend > 0 ? Math.round((convValue / spend) * 100) / 100 : 0;
  const cpm = impressions > 0 ? Math.round((spend / impressions) * 1000 * 100) / 100 : 0;

  return {
    spend: Math.round(spend * 100) / 100,
    impressions,
    clicks,
    ctr,
    conversions: Math.round(conversions * 100) / 100,
    convValue: Math.round(convValue * 100) / 100,
    roas,
    cpm,
  };
}

/** GET all pages from the Worker, returning the flattened data array. */
async function fetchAllPages(path: string, params: Record<string, string>): Promise<InsightRow[]> {
  const qs = new URLSearchParams({ ...params, access_token: PROXY_TOKEN });
  let url: string | null = `${WORKER_BASE}${path}?${qs.toString()}`;
  const all: InsightRow[] = [];
  let page = 0;
  const maxPages = 20;

  while (url && page < maxPages) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Worker HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    const rows: InsightRow[] = json.data ?? [];
    all.push(...rows);
    url = json.paging?.next ?? null;
    // Subsequent pages embed all params in the next URL
    page++;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch live account-level Meta Ads KPIs for GAF for the given window.
 *
 * - All params go to the Cloudflare Worker; the Worker injects the real token.
 * - No Meta token is present anywhere in this file.
 * - Throws on network/HTTP error so the UI can catch and show a fallback.
 */
/**
 * Fetch a playable video source URL for a Meta video ID via the Worker —
 * the same mechanism the reference dashboard uses for inline playback.
 * Returns null when the video has no accessible source.
 */
export async function fetchVideoSource(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  const qs = new URLSearchParams({ fields: "source", access_token: PROXY_TOKEN });
  const res = await fetch(`${WORKER_BASE}/${videoId}?${qs.toString()}`);
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.source === "string" && json.source ? json.source : null;
}

export async function refreshMeta(win: Window): Promise<MetaLiveResult> {
  const { since, until } = windowToDates(win);

  const rows = await fetchAllPages(`/${GAF_ACCOUNT}/insights`, {
    fields: "spend,impressions,clicks,actions,action_values",
    level: "account",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    filtering: JSON.stringify([
      { field: "spend", operator: "GREATER_THAN", value: "0" },
    ]),
  });

  const kpis = insightsToKpis(rows);
  const fetchedAt = new Date().toISOString();

  return { kpis, fetchedAt };
}
