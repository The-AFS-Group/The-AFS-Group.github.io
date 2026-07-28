import { useState, useEffect } from "react";

export type Window = "yesterday" | "7d" | "30d" | "90d" | "lastMonth" | "mtd";

const FEED_URL =
  (import.meta.env?.VITE_FEED_URL as string | undefined) ||
  "https://revel-perf-dashboard.pages.dev/revel-performance-data.json";

// ----- KPI shapes -----

export interface OverviewKpis {
  adSpend: number;
  /** 6% agency fee on Meta + Google media spend only */
  agencyFees?: number;
  /** non-media marketing expenses (expenses ledger minus paid ad spend) folded into MER */
  marketingExpenses?: number;
  /** ad spend + agency fee + marketing expenses (the MER numerator) */
  totalMarketingCost?: number;
  /** NetSuite Sales Array — total sales incl. phone/offline/B2B */
  revenue: number;
  /** Shopify orders revenue, kept for reference */
  shopifyRevenue?: number;
  blendedMer: number;
  sessions: number;
  onlineRevenue: number;
  /** GP actual vs budget from the FY finance sheet (null when not yet entered) */
  gpCreated?: number | null;
  gpBudget?: number | null;
  gpVariancePct?: number | null;
}

export interface GpMonth {
  label?: string;
  mtdActual?: number;
  mtdBudget?: number;
  monthBudget?: number;
  daysElapsed?: number;
  daysInMonth?: number;
  runRate?: number;
  runRateVsBudgetPct?: number | null;
}

export interface SpendSplit {
  meta: number;
  google: number;
  axon: number;
}

export interface DailyPoint {
  date: string;
  [key: string]: number | string;
}

export interface OverviewWindow {
  kpis: OverviewKpis;
  deltas: Record<string, number | null>;
  spendSplit: SpendSplit;
  daily: DailyPoint[];
  gpMonth?: GpMonth;
}

export interface Ga4Kpis {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  engagementRate: number;
  avgEngagementTime: number;
  conversions: number;
  totalRevenue: number;
}

export interface Ga4Window {
  kpis: Ga4Kpis;
  deltas: Record<string, number | null>;
  channels: Record<string, any>;
  topPages: Record<string, any>[];
  geo: Record<string, any>[];
  itemAtc: Record<string, any>[];
  daily: DailyPoint[];
  aiTraffic?: AiTraffic;
}

export interface HubspotKpis {
  totalSends: number;
  avgOpenRate: number;
  avgCtr: number;
  totalRevenue: number;
}

export interface HubspotList {
  name?: string;
  listId?: string;
  size?: number;
  growth30dPct?: number | null;
  history?: Array<{ date: string; size: number }>;
}

export interface HubspotWindow {
  kpis: HubspotKpis;
  sends: Record<string, any>[];
  list?: HubspotList | null;
}

export interface ShopifyKpis {
  orders: number;
  units: number;
  revenue: number;
}

export interface ShopifyWindow {
  kpis: ShopifyKpis;
  deltas?: Record<string, number | null>;
  products: Record<string, any>[];
}

export interface ProductRow {
  handle: string;
  title: string;
  sessions: number;
  atc: number;
  orders: number;
  revenue: number;
  cvr: number;
}

export interface Anomaly {
  metric: string;
  channel: string;
  direction: "up" | "down";
  magnitudePct: number;
  severity: "low" | "medium" | "high";
  label: string;
}

// ----- Meta Ads shapes (per shape doc 2026-07-11) -----

/** 22-key KPI set for a Meta window. All fields optional/guarded. */
export interface MetaKpis {
  spend?: number;
  impressions?: number;
  reach?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  frequency?: number;
  conversions?: number;
  convValue?: number;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  outboundClicks?: number;
  outboundCtr?: number;
  landingPageViews?: number;
  addToCart?: number;
  atcRate?: number;
  cpa?: number;
  costPerAtc?: number;
  engagements?: number;
  engagementRate?: number;
}

/** Row in campaigns / adsets / ads arrays — all KPI fields plus identity. */
export interface MetaEntityRow extends MetaKpis {
  campaignId?: string;
  campaign?: string;
  objective?: string;
  adsetId?: string;
  adset?: string;
  adId?: string;
  ad?: string;
  [key: string]: unknown;
}

export interface MetaDailyPoint {
  date: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  convValue?: number;
  [key: string]: number | string | undefined;
}

export interface MetaCreativeRow {
  adId?: string;
  adName?: string;
  campaign?: string;
  campaignId?: string;
  adset?: string;
  objective?: string;
  previewLink?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoId?: string;
  body?: string;
  title?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  purchases?: number;
  purchaseValue?: number;
  roas?: number;
  outboundClicks?: number;
  addToCart?: number;
  atcRate?: number;
  landingPageViews?: number;
  cpa?: number;
  reach?: number;
  cpc?: number;
  cpm?: number;
  frequency?: number;
  engagements?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

export interface MetaVideoRow {
  adId?: string;
  adName?: string;
  campaign?: string;
  spend?: number;
  videoPlays?: number;
  thruPlays?: number;
  p25Rate?: number;
  p50Rate?: number;
  p75Rate?: number;
  p100Rate?: number;
  impressions?: number;
  avgWatchTime?: number;
  atc?: number;
  engagements?: number;
  thumbStopRate?: number;
  engagementRate?: number;
  [key: string]: unknown;
}

export interface MetaBreakdownRow extends MetaKpis {
  segment?: string;
  [key: string]: unknown;
}

export interface MetaBreakdowns {
  platform?: MetaBreakdownRow[];
  placement?: MetaBreakdownRow[];
  age?: MetaBreakdownRow[];
  gender?: MetaBreakdownRow[];
  region?: MetaBreakdownRow[];
}

export interface MetaWindow {
  kpis?: MetaKpis;
  deltas?: Record<string, number | null>;
  campaigns?: MetaEntityRow[];
  adsets?: MetaEntityRow[];
  daily?: MetaDailyPoint[];
  creative?: MetaCreativeRow[];
  video?: MetaVideoRow[];
  breakdowns?: MetaBreakdowns;
}

// ----- Google Ads shapes -----

export interface GoogleKpis {
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  avgCpc?: number;
  conversions?: number;
  convValue?: number;
  roas?: number;
  cpa?: number;
  atc?: number;
  atcRate?: number;
  searchImprShare?: number | null;
}

export interface GoogleRow extends Record<string, unknown> {
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  avgCpc?: number;
  conversions?: number;
  convValue?: number;
  roas?: number;
  cpa?: number;
  atc?: number;
  atcRate?: number;
  name?: string;
  channel?: string;
  adGroup?: string;
  keyword?: string;
  matchType?: string;
  searchTerm?: string;
  ad?: string;
  campaign?: string;
  searchImprShare?: number | null;
  spendDelta?: number | null;
  roasDelta?: number | null;
}

export interface GoogleWindow {
  kpis?: GoogleKpis;
  deltas?: Record<string, number | null>;
  campaigns?: GoogleRow[];
  adGroups?: GoogleRow[];
  keywords?: GoogleRow[];
  searchTerms?: GoogleRow[];
  ads?: GoogleRow[];
  daily?: DailyPoint[];
}

// ----- SEO / AEO shapes -----

export interface SeoKpis {
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface SeoRow extends Record<string, unknown> {
  query?: string;
  page?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface SeoWindow {
  kpis?: SeoKpis;
  deltas?: Record<string, number | null>;
  daily?: DailyPoint[];
  topQueries?: SeoRow[];
  topPages?: SeoRow[];
  dataThrough?: string;
}

export interface AiTraffic {
  kpis?: { sessions?: number; conversions?: number; revenue?: number; shareOfSessions?: number };
  deltas?: Record<string, number | null>;
  sources?: Array<Record<string, unknown>>;
  daily?: DailyPoint[];
}

// ----- Pinterest shapes -----

export interface PinterestWindow {
  connected?: boolean;
  kpis?: Record<string, number>;
  deltas?: Record<string, number | null>;
  campaigns?: Array<Record<string, unknown>>;
  daily?: DailyPoint[];
}

// ----- Experiments (Asana board snapshot, not window-keyed) -----

export interface ExperimentRow {
  gid?: string;
  name?: string;
  section?: string;
  owner?: string;
  channel?: string;
  funnelStage?: string;
  ice?: number | null;
  winLoss?: string;
  completed?: boolean;
  completedAt?: string;
  createdAt?: string;
  url?: string;
}

export interface ExperimentsData {
  sections?: Array<{ name: string; count: number }>;
  summary?: {
    total?: number;
    backlog?: number;
    thisSprint?: number;
    running?: number;
    analysing?: number;
    learnings?: number;
    wins?: number;
    losses?: number;
    inconclusive?: number;
    winRatePct?: number | null;
    completedLast30d?: number;
  };
  experiments?: ExperimentRow[];
}

// ----- Marketing Expenses shapes -----

export interface ExpenseLineItem {
  name: string;
  category: string;
  /** TRUE = paid ad-channel spend (already shown on Meta/Google/Axon tabs) */
  mediaSpend: boolean;
  amount: number;
  count: number;
}

export interface ExpensesWindow {
  lineItems: ExpenseLineItem[];
  total: number;
  totalExMedia: number;
  count: number;
  dataThrough: string | null;
}

// ----- Axon shapes -----

export interface AxonKpis {
  spend?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  conversions?: number;
  sales?: number;
  roas?: number;
  cpa?: number;
}

export interface AxonWindow {
  kpis?: AxonKpis;
  deltas?: Record<string, number | null>;
  campaigns?: Record<string, unknown>[];
  creativeSets?: Record<string, unknown>[];
  daily?: DailyPoint[];
}

// ----- Organic (top-level, NOT window-keyed; 30d snapshot) -----

export interface OrganicPost {
  id?: string;
  thumbnail?: string;
  caption?: string;
  mediaType?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  timestamp?: string;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  permalink?: string;
}

export interface OrganicIg {
  reach?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
  views?: number;
  followerCount?: number;
  posts?: OrganicPost[];
  reachDaily?: Array<{ date: string; reach: number }>;
  postsPublished?: number;
  engagementBreakdown?: { likes?: number; comments?: number; saves?: number; shares?: number };
}

export interface OrganicFbPage {
  fanCount?: number;
  talkingAbout?: number;
}

export interface OrganicData {
  ig?: OrganicIg;
  fbPage?: OrganicFbPage;
}

// ----- Full feed type -----

type WindowedRecord<T> = {
  [W in Window]?: T;
};

export interface PerfData {
  generated_at: string;
  windows: Window[];
  // Per-channel paid media
  meta: WindowedRecord<MetaWindow>;
  google: WindowedRecord<GoogleWindow>;
  axon: WindowedRecord<AxonWindow>;
  // Organic social — top-level, not window-keyed (30d snapshot)
  organic?: OrganicData;
  // Typed sections used by dashboard tabs
  ga4: WindowedRecord<Ga4Window>;
  hubspot: WindowedRecord<HubspotWindow>;
  shopify: WindowedRecord<ShopifyWindow>;
  seo?: WindowedRecord<SeoWindow>;
  pinterest?: WindowedRecord<PinterestWindow>;
  expenses?: WindowedRecord<ExpensesWindow>;
  experiments?: ExperimentsData;
  products: WindowedRecord<ProductRow[]>;
  overview: WindowedRecord<OverviewWindow>;
  anomalies: WindowedRecord<Anomaly[]>;
  narrative: WindowedRecord<string | null>;
}

// ----- Hook -----

export interface UseDataResult {
  data: PerfData | null;
  loading: boolean;
  error: unknown;
  /** Re-fetch the snapshot feed, bypassing any HTTP cache */
  reload: () => void;
}

export function useData(): UseDataResult {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        // Cache-bust on manual reload only; first load uses the plain URL.
        const url = nonce === 0 ? FEED_URL : `${FEED_URL}?t=${Date.now()}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json: PerfData = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { data, loading, error, reload: () => setNonce(n => n + 1) };
}
