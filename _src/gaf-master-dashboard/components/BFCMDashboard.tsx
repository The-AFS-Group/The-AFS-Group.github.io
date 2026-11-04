import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea, Cell, Legend,
} from "recharts";
import {
  Flame, Calendar, Info, RefreshCw, Target, TrendingUp, TrendingDown, Percent, Eye, DollarSign,
  Users, PhoneIncoming, Trophy, Video, Heart, MessageCircle, ExternalLink, Megaphone, MousePointerClick,
  ArrowUp, ArrowDown, Activity, Clock,
} from "lucide-react";
import {
  fetchGafDailyData, fetchGafPerformanceFeed, fetchGafRecentInstagramPosts, getBfcmCache,
  BfcmDay as DayData, BfcmBudget as DayBudget, BfcmDaily, GafPerformanceFeed, BfcmPost as InstagramPost, AdCreative, PerfProduct,
} from "../services/bfcmService";
import { GAF_COLORS } from "../constants";

// GAF version of the Revel Master Dashboard BFCM tab. Same layout and maths, GAF sources.
// Same sheet as Sales Health (GAF DATA tab)
const DATA_SOURCE_URL = "https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=0#gid=0";
const PERF_DASHBOARD_URL = "/gaf-performance-dashboard/";
const SITE = "https://www.gymandfitness.com.au/products/";

const ACCENT = "#F26422"; // GAF orange, "actual"
const DARK = "#111111"; // GAF black, "today / live"
const TARGET = "#94a3b8"; // slate, targets and pace lines
const GRID = "#f1f5f9";
const AXIS_TICK = { fontSize: 11, fill: "#64748b" };

const TARGET_MARGIN = 42; // matches GAF Sales Health
const TARGET_DISCOUNT = 10; // matches GAF Sales Health

const LIVE_REFRESH_MS = 5 * 60 * 1000;
const FEED_REFRESH_MS = 30 * 60 * 1000;
const MONTH = 10; // November (0-based)

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const adelaideNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Adelaide" }));
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`;
const kMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1000000) return `${n < 0 ? "-" : ""}$${(a / 1000000).toFixed(2)}m`;
  if (a >= 1000) return `${n < 0 ? "-" : ""}$${(a / 1000).toFixed(1)}k`;
  return money(n);
};
const axisK = (v: number) =>
  Math.abs(v) >= 1000000 ? `${(v / 1000000).toFixed(1)}m` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n).toLocaleString()}`;

/** US Thanksgiving is the 4th Thursday of November; Black Friday follows, Cyber Monday 3 days later. */
const bfcmDates = (year: number) => {
  const first = new Date(year, MONTH, 1);
  const firstThursday = 1 + ((4 - first.getDay() + 7) % 7);
  const blackFriday = new Date(year, MONTH, firstThursday + 22);
  const cyberMonday = new Date(year, MONTH, firstThursday + 25);
  return { blackFriday, cyberMonday };
};

const shortcode = (url: string) => (url || "").split("?")[0].split("/").filter(Boolean).pop() || url;

const tooltipStyle = {
  backgroundColor: "rgba(255,255,255,0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  fontSize: "13px",
};

const UpdatingBadge: React.FC<{ isUpdating: boolean }> = ({ isUpdating }) =>
  isUpdating ? (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full shadow-sm z-10">
      <RefreshCw className="w-3 h-3 text-orange-500 animate-spin" />
      <span className="text-[10px] font-medium text-gray-600 uppercase tracking-wider">Updating</span>
    </div>
  ) : null;

const DashboardSkeleton = () => (
  <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 animate-pulse">
    <div className="h-14 bg-white rounded-2xl border border-gray-200" />
    <div className="h-40 bg-white rounded-2xl border border-gray-200" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, k) => <div key={k} className="h-24 bg-white rounded-xl border border-gray-200" />)}
    </div>
    <div className="h-80 bg-white rounded-2xl border border-gray-200" />
  </div>
);

interface DayRow {
  day: number;
  label: string;
  fullDate: string;
  isToday: boolean;
  isFuture: boolean;
  gp: number | null;
  margin: number | null;
  discount: number | null;
  sessions: number | null;
  targetSessions: number;
  inboundCalls: number | null;
  cumActual: number | null;
  cumTarget: number;
  newLeads: number | null; // contacts added (days the list grew)
  leadCleanup: number | null; // contacts removed on a net-drop day (list hygiene)
}

const Card: React.FC<{ children: React.ReactNode; className?: string; updating?: boolean }> = ({ children, className = "", updating = false }) => (
  <div className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-5 md:p-6 relative ${className}`}>
    <UpdatingBadge isUpdating={updating} />
    {children}
  </div>
);

const CardTitle: React.FC<{ icon: React.ElementType; title: string; sub?: string; right?: React.ReactNode }> = ({ icon: Icon, title, sub, right }) => (
  <div className="flex items-start justify-between gap-3 mb-5">
    <div className="flex items-center gap-3 min-w-0">
      <div className="p-2 rounded-lg bg-gradient-to-br from-gray-800 to-black shadow-sm shrink-0">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
    {right}
  </div>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }> = ({ label, value, sub, className = "" }) => (
  <div className={`p-4 rounded-xl bg-gray-50 border border-gray-100 min-w-0 ${className}`}>
    <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
    <p className="text-2xl font-bold text-gray-900 break-words">{value}</p>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const PostCard: React.FC<{ post: InstagramPost; index: number }> = ({ post, index }) => {
  const [hasError, setHasError] = useState(false);
  const published = post.publishedAt ? new Date(post.publishedAt) : null;
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex-shrink-0 w-56 xl:w-auto min-w-0 flex flex-col snap-start group"
    >
      <div className="relative aspect-[4/5] bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-xl">
        {!hasError && post.thumbnailUrl ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setHasError(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Video size={40} strokeWidth={1.5} className="text-gray-400" />
        )}
        <div className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md" style={{ backgroundColor: DARK }}>
          {index + 1}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-900">{post.totalInteractions.toLocaleString()} interactions</span>
          {published && <span className="text-gray-400">{published.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
        </div>
        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed flex-1">{post.caption}</p>
        <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1"><Heart size={13} className="text-red-500 fill-red-500" />{post.likes.toLocaleString()}</span>
          <span className="flex items-center gap-1"><MessageCircle size={13} />{post.comments.toLocaleString()}</span>
          {post.views > 0 && <span className="flex items-center gap-1"><Eye size={13} />{post.views.toLocaleString()}</span>}
        </div>
      </div>
    </a>
  );
};

const AdCard: React.FC<{ ad: AdCreative; index: number }> = ({ ad, index }) => {
  const [hasError, setHasError] = useState(false);
  const Wrapper: React.ElementType = ad.previewLink ? "a" : "div";
  return (
    <Wrapper
      {...(ad.previewLink ? { href: ad.previewLink, target: "_blank", rel: "noopener noreferrer" } : {})}
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex-shrink-0 w-56 xl:w-auto min-w-0 flex flex-col snap-start group"
    >
      <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden rounded-t-xl">
        {!hasError && ad.thumbnailUrl ? (
          <img
            src={ad.thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setHasError(true)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Megaphone size={40} strokeWidth={1.5} className="text-gray-400" />
        )}
        <div className="absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md" style={{ backgroundColor: DARK }}>
          {index + 1}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2">
        <p className="text-xs font-semibold text-gray-900 line-clamp-2 break-all" title={ad.adName}>{ad.adName}</p>
        <p className="text-[11px] text-gray-400 truncate" title={ad.campaign}>{ad.campaign}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pt-2 border-t border-gray-100 mt-auto">
          <span className="text-gray-500">Link clicks</span><span className="font-bold text-gray-900 text-right">{Math.round(ad.outboundClicks).toLocaleString()}</span>
          <span className="text-gray-500">CTR</span><span className="font-bold text-gray-900 text-right">{ad.ctr.toFixed(2)}%</span>
          <span className="text-gray-500">Spend</span><span className="font-bold text-gray-900 text-right">{money(ad.spend)}</span>
          <span className="text-gray-500">Purchases</span><span className="font-bold text-gray-900 text-right">{Math.round(ad.purchases).toLocaleString()}</span>
        </div>
      </div>
    </Wrapper>
  );
};

interface TrendRow {
  title: string;
  handle: string;
  last7: number;
  priorWeekly: number;
  delta: number;
}

const TrendList: React.FC<{ rows: TrendRow[]; direction: "up" | "down" }> = ({ rows, direction }) => {
  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-400 italic">No products trending {direction} this week</div>;
  }
  const up = direction === "up";
  return (
    <ul className="divide-y divide-gray-100">
      {rows.map((t) => (
        <li key={t.handle || t.title} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <a
              href={t.handle ? `${SITE}${t.handle}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-900 hover:underline line-clamp-1"
              title={t.title}
            >
              {t.title}
            </a>
            <p className="text-xs text-gray-400 mt-0.5">
              Last 7d {money(t.last7)} · prior weekly avg {money(t.priorWeekly)}
            </p>
          </div>
          <div className={`flex items-center gap-1 text-sm font-bold shrink-0 ${up ? "text-emerald-600" : "text-red-500"}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <span>{up ? "+" : "-"}{money(Math.abs(t.delta))}</span>
            <span className="sr-only">{up ? "up" : "down"} versus prior weekly average</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default function BFCMDashboard() {
  const [daily, setDaily] = useState<BfcmDaily | null>(getBfcmCache<BfcmDaily>("daily"));
  const [feed, setFeed] = useState<GafPerformanceFeed | null>(getBfcmCache<GafPerformanceFeed>("perf_feed"));
  const [sheetPosts, setSheetPosts] = useState<InstagramPost[]>(getBfcmCache<InstagramPost[]>("ig_7") || []);
  const [isUpdating, setIsUpdating] = useState(true);
  const [isFeedUpdating, setIsFeedUpdating] = useState(!feed);
  const [metricType, setMetricType] = useState<"created" | "fulfilled">("created");
  const [, setTick] = useState(0);

  const loadDaily = useCallback(async () => {
    setIsUpdating(true);
    try {
      const res = await fetchGafDailyData();
      if (res.allData.length > 0) setDaily(res);
    } catch (e) {
      console.error("BFCM: failed to load daily sales", e);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const loadFeed = useCallback(async (force = false) => {
    // The IG feed tab only adds views/reach to posts the performance feed already has, and Google
    // takes ~30s to serve it, so it loads quietly in the background without holding the badge.
    fetchGafRecentInstagramPosts(7, force).then(setSheetPosts).catch(() => undefined);
    setIsFeedUpdating(true);
    try {
      const res = await fetchGafPerformanceFeed(force);
      if (res) setFeed(res);
    } catch (e) {
      console.error("BFCM: failed to load performance feed", e);
    } finally {
      setIsFeedUpdating(false);
    }
  }, []);

  useEffect(() => {
    loadDaily();
    loadFeed();
    const live = setInterval(loadDaily, LIVE_REFRESH_MS);
    const slow = setInterval(() => loadFeed(true), FEED_REFRESH_MS);
    const clock = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => { clearInterval(live); clearInterval(slow); clearInterval(clock); };
  }, [loadDaily, loadFeed]);

  const now = adelaideNow();
  // Jul-Dec: this year's November (build-up, live, review). Jan-Jun: last November.
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const daysInMonth = new Date(year, MONTH + 1, 0).getDate();
  const monthPrefix = `${year}-${String(MONTH + 1).padStart(2, "0")}-`;
  const status: "before" | "live" | "after" =
    now.getFullYear() === year && now.getMonth() === MONTH ? "live"
      : (now.getFullYear() < year || (now.getFullYear() === year && now.getMonth() < MONTH)) ? "before" : "after";
  const todayDay = status === "live" ? now.getDate() : 0;
  const completedDays = status === "live" ? todayDay - 1 : status === "after" ? daysInMonth : 0;
  const isCreated = metricType === "created";

  const { blackFriday, cyberMonday } = bfcmDates(year);
  const bfLabel = `${MONTH_SHORT[MONTH]} ${blackFriday.getDate()}`;
  const cmInMonth = cyberMonday.getMonth() === MONTH;
  const bfcmEndLabel = `${MONTH_SHORT[MONTH]} ${cmInMonth ? cyberMonday.getDate() : daysInMonth}`;
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysToBlackFriday = Math.round((blackFriday.getTime() - today0.getTime()) / 86400000);
  const daysPastCyberMonday = Math.round((today0.getTime() - cyberMonday.getTime()) / 86400000);
  const countdown =
    daysToBlackFriday > 1 ? `${daysToBlackFriday} days to Black Friday`
      : daysToBlackFriday === 1 ? "Black Friday is tomorrow"
        : daysPastCyberMonday <= 0 ? "BFCM weekend is live"
          : "BFCM weekend complete";

  const model = useMemo(() => {
    const allData = daily?.allData || [];
    const allBudget = daily?.allBudgetData || [];
    const rowsByDate = new Map<string, DayData>();
    allData.forEach((d) => { if (d.fullDate?.startsWith(monthPrefix)) rowsByDate.set(d.fullDate, d); });
    const budgetByDate = new Map<string, DayBudget>();
    allBudget.forEach((b) => { if (b.fullDate?.startsWith(monthPrefix)) budgetByDate.set(b.fullDate, b); });

    let monthBudget = 0;
    let monthSessionsTarget = 0;
    budgetByDate.forEach((b) => {
      monthBudget += isCreated ? b.grossProfitCreatedBudget : b.grossProfitFulfilledBudget;
      monthSessionsTarget += b.targetSessions;
    });
    const dailyPace = monthBudget / daysInMonth;
    const dailySessionsTarget = monthSessionsTarget / daysInMonth;

    const leadsByDate = new Map<string, number>();
    (feed?.leads || []).forEach((l) => leadsByDate.set(l.date, l.newLeads));

    const rows: DayRow[] = [];
    let cum = 0;
    let actualCompleted = 0;
    let todayRow: DayData | undefined;
    let marginGP = 0, marginRev = 0, discAmt = 0, discGross = 0;
    let sessionsTotal = 0, sessionsCompleted = 0, inboundTotal = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const fullDate = `${monthPrefix}${String(day).padStart(2, "0")}`;
      const r = rowsByDate.get(fullDate);
      const isToday = status === "live" && day === todayDay;
      const isFuture = status === "before" || (status === "live" && day > todayDay);
      const gpVal = r ? (isCreated ? r.grossProfitCreated || 0 : r.grossProfitFulfilled || 0) : 0;
      const marginVal = r ? (isCreated ? r.grossMarginCreated || 0 : r.grossMarginFulfilled || 0) : 0;
      // Column 13 of the sheet is the sales discount % on created orders
      const discVal = r?.salesDiscountFulfilled || 0;
      const createdGP = r?.grossProfitCreated || 0;
      const createdMargin = r?.grossMarginCreated || 0;

      if (!isFuture) {
        cum += gpVal;
        if (!isToday) actualCompleted += gpVal;
        if (isToday) todayRow = r;
        if (gpVal && marginVal) {
          marginGP += gpVal;
          marginRev += gpVal / (marginVal / 100);
        }
        if (createdGP && createdMargin && discVal < 100) {
          const rev = createdGP / (createdMargin / 100);
          const gross = rev / (1 - discVal / 100);
          discGross += gross;
          discAmt += gross - rev;
        }
        sessionsTotal += r?.sessions || 0;
        if (!isToday) sessionsCompleted += r?.sessions || 0;
        inboundTotal += r?.inboundSalesCalls || 0;
      }

      rows.push({
        day,
        label: `${MONTH_SHORT[MONTH]} ${day}`,
        fullDate,
        isToday,
        isFuture,
        gp: isFuture ? null : gpVal || (isToday ? 0 : null),
        margin: isFuture || !gpVal || !marginVal ? null : marginVal,
        discount: isFuture || !createdGP ? null : discVal,
        sessions: isFuture ? null : r?.sessions || null,
        targetSessions: dailySessionsTarget,
        inboundCalls: isFuture ? null : r?.inboundSalesCalls ?? null,
        cumActual: isFuture ? null : cum,
        cumTarget: dailyPace * day,
        newLeads: leadsByDate.has(fullDate) ? Math.max(0, leadsByDate.get(fullDate)!) : null,
        leadCleanup: leadsByDate.has(fullDate) && leadsByDate.get(fullDate)! < 0 ? -leadsByDate.get(fullDate)! : null,
      });
    }

    const todayActual = todayRow ? (isCreated ? todayRow.grossProfitCreated || 0 : todayRow.grossProfitFulfilled || 0) : 0;
    const actualMTD = actualCompleted + todayActual;
    const targetToDate = dailyPace * completedDays;
    const daysLeftInclToday = daysInMonth - completedDays;
    const runRate = completedDays > 0 ? actualCompleted / completedDays : 0;
    const projected = actualCompleted + runRate * daysLeftInclToday;
    const neededPerDay = daysLeftInclToday > 0 ? Math.max(0, monthBudget - actualCompleted) / daysLeftInclToday : 0;

    const todayMarginPct = todayRow ? (isCreated ? todayRow.grossMarginCreated : todayRow.grossMarginFulfilled) || 0 : 0;
    const todayDiscount = todayRow && todayRow.grossProfitCreated ? todayRow.salesDiscountFulfilled || 0 : 0;

    return {
      rows,
      monthBudget,
      dailyPace,
      dailySessionsTarget,
      actualCompleted,
      todayActual,
      actualMTD,
      targetToDate,
      paceVariance: actualCompleted - targetToDate,
      pacePct: targetToDate > 0 ? (actualCompleted / targetToDate) * 100 : 0,
      projected,
      projectedPct: monthBudget > 0 ? (projected / monthBudget) * 100 : 0,
      neededPerDay,
      progressPct: monthBudget > 0 ? (actualMTD / monthBudget) * 100 : 0,
      pacePosPct: monthBudget > 0 ? (targetToDate / monthBudget) * 100 : 0,
      weightedMargin: marginRev > 0 ? (marginGP / marginRev) * 100 : 0,
      weightedDiscount: discGross > 0 ? (discAmt / discGross) * 100 : 0,
      sessionsTotal,
      avgDailySessions: completedDays > 0 ? sessionsCompleted / completedDays : sessionsTotal,
      todaySessions: todayRow?.sessions || 0,
      todayInbound: todayRow?.inboundSalesCalls || 0,
      inboundTotal,
      todayMarginPct,
      todayDiscount,
      hasTodayRow: !!todayRow,
      daysLeftInclToday,
    };
  }, [daily, feed, isCreated, monthPrefix, daysInMonth, status, todayDay, completedDays]);

  // ---- Leads (HubSpot list growth from the performance feed) ----
  const leads = useMemo(() => {
    const all = feed?.leads || [];
    const month = all.filter((l) => l.date.startsWith(monthPrefix));
    const prevPrefix = `${year}-${String(MONTH).padStart(2, "0")}-`;
    const prev = all.filter((l) => l.date.startsWith(prevPrefix));
    // HubSpot only publishes list size, so a day's change is adds minus removals. Removals come
    // in monthly clean-ups (1 Aug, 1 Oct, 1 Nov), so count growth days as new leads and report
    // the clean-up separately rather than letting it wipe out the month's leads.
    const adds = (rows: typeof all) => rows.reduce((s, l) => s + Math.max(0, l.newLeads), 0);
    const added = adds(month);
    const cleanup = month.reduce((s, l) => s + Math.min(0, l.newLeads), 0);
    const net = month.reduce((s, l) => s + l.newLeads, 0);
    const latest = all.length ? all[all.length - 1] : null;
    const prevAvg = prev.length ? adds(prev) / prev.length : 0;
    const avg = month.length ? added / month.length : 0;
    return { month, added, cleanup, net, latest, prevAvg, avg, listName: feed?.leadListName || "HubSpot list" };
  }, [feed, monthPrefix, year]);

  // ---- Products (Shopify, from the performance feed) ----
  const products = useMemo(() => {
    const p7 = feed?.products7d || [];
    const p30 = feed?.products30d || [];
    const top = [...p7].filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const rev30 = new Map<string, PerfProduct>();
    p30.forEach((p) => rev30.set(p.handle || p.title, p));

    const map7 = new Map<string, PerfProduct>();
    p7.forEach((p) => map7.set(p.handle || p.title, p));
    const keys = new Set<string>([...map7.keys(), ...rev30.keys()]);
    const trends: TrendRow[] = [];
    keys.forEach((k) => {
      const a = map7.get(k);
      const b = rev30.get(k);
      const last7 = a?.revenue || 0;
      const last30 = Math.max(b?.revenue || 0, last7);
      // Weekly average of the 23 days before the last 7
      const priorWeekly = ((last30 - last7) * 7) / 23;
      trends.push({ title: a?.title || b?.title || k, handle: a?.handle || b?.handle || "", last7, priorWeekly, delta: last7 - priorWeekly });
    });
    const up = trends.filter((t) => t.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
    const down = trends.filter((t) => t.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);
    return { top, rev30, up, down };
  }, [feed]);

  // ---- Content, last 7 days ----
  const content = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    const merged = new Map<string, InstagramPost>();
    const add = (p: InstagramPost) => {
      if (!p.publishedAt || new Date(p.publishedAt).getTime() < cutoff) return;
      const key = shortcode(p.permalink);
      const existing = merged.get(key);
      if (!existing) { merged.set(key, p); return; }
      // Keep the richer record (the sheet has views/reach/shares), the bigger counts and a working thumbnail
      merged.set(key, {
        ...existing,
        ...(p.views > existing.views ? p : {}),
        likes: Math.max(existing.likes, p.likes),
        comments: Math.max(existing.comments, p.comments),
        totalInteractions: Math.max(existing.totalInteractions, p.totalInteractions),
        thumbnailUrl: existing.thumbnailUrl || p.thumbnailUrl,
      });
    };
    sheetPosts.forEach(add);
    (feed?.igPosts || []).forEach(add);
    const organic = [...merged.values()].sort((a, b) => b.totalInteractions - a.totalInteractions).slice(0, 5);
    const paid = [...(feed?.adCreative7d || [])].filter((a) => a.spend > 0).sort((a, b) => b.outboundClicks - a.outboundClicks).slice(0, 5);
    return { organic, paid };
  }, [sheetPosts, feed]);

  if (!daily && isUpdating) return <DashboardSkeleton />;

  const m = model;
  const ahead = m.paceVariance >= 0;
  const todayPct = m.dailyPace > 0 ? (m.todayActual / m.dailyPace) * 100 : 0;
  const syncedAt = daily?.fetchedAt ? new Date(daily.fetchedAt).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }) : null;
  const feedAt = feed?.generatedAt ? new Date(feed.generatedAt) : null;
  const monthLabel = new Date(year, MONTH, 1).toLocaleString("en-AU", { month: "long", year: "numeric" });
  const metricLabel = isCreated ? "Created" : "Fulfilled";
  const bfcmArea = (
    <ReferenceArea
      x1={bfLabel}
      x2={bfcmEndLabel}
      fill={DARK}
      fillOpacity={0.07}
      label={{ value: "BFCM", position: "top", fontSize: 10, fill: DARK, fontWeight: 700 }}
    />
  );
  const xAxis = <XAxis dataKey="label" tick={AXIS_TICK} stroke="#cbd5e1" interval="preserveStartEnd" minTickGap={18} />;

  const dailyCharts: {
    title: string;
    sub: string;
    icon: React.ElementType;
    dataKey: keyof DayRow;
    ref: number;
    refLabel: string;
    fmt: (v: number) => string;
    axis: (v: number) => string;
  }[] = [
    {
      title: `Daily Gross Profit (${metricLabel})`,
      sub: "Bars are actual GP; the dashed line is the daily pace (budget ÷ days in month)",
      icon: TrendingUp,
      dataKey: "gp",
      ref: m.dailyPace,
      refLabel: `Pace ${kMoney(m.dailyPace)}`,
      fmt: (v) => money(v),
      axis: axisK,
    },
    {
      title: `Gross Margin (${metricLabel})`,
      sub: `Daily GP margin vs the ${TARGET_MARGIN}% target`,
      icon: Percent,
      dataKey: "margin",
      ref: TARGET_MARGIN,
      refLabel: `Target ${TARGET_MARGIN}%`,
      fmt: (v) => `${v.toFixed(1)}%`,
      axis: (v) => `${v}%`,
    },
    {
      title: "Avg Discount (Created)",
      sub: `Daily sales discount vs the ${TARGET_DISCOUNT}% target`,
      icon: DollarSign,
      dataKey: "discount",
      ref: TARGET_DISCOUNT,
      refLabel: `Target ${TARGET_DISCOUNT}%`,
      fmt: (v) => `${v.toFixed(1)}%`,
      axis: (v) => `${v}%`,
    },
    {
      title: "Daily Website Traffic",
      sub: "Sessions per day vs the daily sessions target",
      icon: Eye,
      dataKey: "sessions",
      ref: m.dailySessionsTarget,
      refLabel: `Target ${Math.round(m.dailySessionsTarget).toLocaleString()}`,
      fmt: (v) => Math.round(v).toLocaleString(),
      axis: axisK,
    },
  ];

  return (
    <div className="min-h-screen bg-transparent pb-20 font-sans">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}>
                BFCM
              </h1>
              <a href={DATA_SOURCE_URL} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-orange-500 transition-colors" title="View source spreadsheet">
                <Info size={16} />
              </a>
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold text-white" style={{ backgroundColor: DARK }}>
                <Flame className="w-3 h-3" /> {countdown}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs mt-0.5" style={{ color: GAF_COLORS.darkGrey }}>
              <Calendar className="w-3 h-3" />
              <span>
                {monthLabel} · Black Friday {blackFriday.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })} · Cyber Monday {cyberMonday.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <button
              onClick={loadDaily}
              disabled={isUpdating}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-60"
              title="Refresh sales now (auto-refreshes every 5 minutes)"
            >
              <span className="relative flex h-2 w-2">
                {status === "live" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: ACCENT }} />}
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: status === "live" ? DARK : TARGET }} />
              </span>
              <span>{syncedAt ? `Synced ${syncedAt}` : "Syncing…"}</span>
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            </button>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {(["created", "fulfilled"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setMetricType(t)}
                  className={`px-4 py-1.5 rounded-md font-medium text-xs md:text-sm transition-all ${metricType === t ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {t === "created" ? "Created" : "Fulfilled"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8">
        {/* ---------- Today, live ---------- */}
        {status === "live" ? (
          <Card updating={isUpdating} className="overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: DARK }} />
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="lg:w-[42%] min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: ACCENT }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: DARK }} />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: DARK }}>Today · live</span>
                  <span className="text-xs text-gray-400">{now.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}</span>
                </div>
                <p className="text-sm font-medium text-gray-600">GP {metricLabel} today</p>
                <p className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mt-1" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  {money(m.todayActual)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  of {money(m.dailyPace)} daily pace · <span className="font-semibold text-gray-900">{todayPct.toFixed(0)}%</span>
                </p>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mt-3" role="progressbar" aria-valuenow={Math.round(todayPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Today's GP against daily pace">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, todayPct)}%`, backgroundColor: todayPct >= 100 ? DARK : ACCENT }} />
                </div>
                {m.todayActual === 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-3">
                    <Clock className="w-3.5 h-3.5 mt-px shrink-0" />
                    Today's orders haven't posted to the GAF DATA sheet yet. This checks it every 5 minutes.
                  </p>
                )}
              </div>
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                <Tile label="Sessions today" value={m.todaySessions.toLocaleString()} sub={`Target ${Math.round(m.dailySessionsTarget).toLocaleString()}`} />
                <Tile label="Margin today" value={m.todayMarginPct ? `${m.todayMarginPct.toFixed(1)}%` : "–"} sub={`Target ${TARGET_MARGIN}%`} />
                <Tile label="Discount today" value={m.todayDiscount ? `${m.todayDiscount.toFixed(1)}%` : "–"} sub={`Target ${TARGET_DISCOUNT}%`} />
                <Tile label="Needed per day" value={money(m.neededPerDay)} sub={`to hit budget, ${m.daysLeftInclToday} days left incl. today`} />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Flame className="w-5 h-5" style={{ color: DARK }} />
              {status === "before"
                ? `BFCM month starts 1 ${MONTH_SHORT[MONTH]}. Budget and pacing below are set; actuals fill in once the month begins.`
                : `${monthLabel} is complete. Figures below are the final BFCM month result.`}
            </div>
          </Card>
        )}

        {/* ---------- Summary: budget and pacing ---------- */}
        <Card updating={isUpdating}>
          <CardTitle icon={Target} title="BFCM Budget & Pacing" sub={`${monthLabel} · GP ${metricLabel} · daily pace = budget ÷ ${daysInMonth} days`} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Tile label={`Total GP ${metricLabel}`} value={money(m.actualMTD)} sub={status === "live" ? `incl. today's ${money(m.todayActual)}` : undefined} />
            <Tile label="GP Target (Budget)" value={money(m.monthBudget)} sub={`Daily pace ${money(m.dailyPace)}`} />
            <Tile label="Avg Gross Margin" value={m.weightedMargin ? `${m.weightedMargin.toFixed(1)}%` : "–"} sub={`Target: ${TARGET_MARGIN}%`} />
            <Tile label="Avg Discount (Created)" value={m.weightedDiscount ? `${m.weightedDiscount.toFixed(1)}%` : "–"} sub={`Target: ${TARGET_DISCOUNT}%`} />
            <Tile
              label="Daily Web Traffic"
              value={`${Math.round(m.avgDailySessions).toLocaleString()} / day`}
              sub={`${m.sessionsTotal.toLocaleString()} sessions this month · target ${Math.round(m.dailySessionsTarget).toLocaleString()} / day`}
            />
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Budget progress</span>
              <span className="text-sm font-semibold text-gray-900">{m.progressPct.toFixed(1)}% of {money(m.monthBudget)}</span>
            </div>
            <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-visible">
              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, m.progressPct)}%`, backgroundColor: ahead ? ACCENT : "#ef4444" }} />
              {completedDays > 0 && completedDays < daysInMonth && (
                <div className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-gray-900" style={{ left: `${Math.min(100, m.pacePosPct)}%` }} title={`Pace to date: ${money(m.targetToDate)}`}>
                  <span className="absolute top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-gray-700">pace</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white/50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Daily pacing target</p>
              <p className="text-lg font-semibold text-gray-900">{money(m.dailyPace)} / day</p>
              <p className="text-xs text-gray-500 mt-1">{money(m.monthBudget)} ÷ {daysInMonth} days</p>
            </div>
            <div className="p-4 bg-white/50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Pace to date{status === "live" ? " (to yesterday)" : ""}</p>
              <p className={`text-lg font-semibold flex items-center gap-1 ${completedDays === 0 ? "text-gray-900" : ahead ? "text-emerald-600" : "text-red-500"}`}>
                {completedDays === 0 ? "–" : (
                  <>
                    {ahead ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {money(Math.abs(m.paceVariance))} {ahead ? "ahead" : "behind"}
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {completedDays === 0 ? "No completed days yet" : `${money(m.actualCompleted)} vs ${money(m.targetToDate)} target · ${m.pacePct.toFixed(0)}%`}
              </p>
            </div>
            <div className="p-4 bg-white/50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">{status === "after" ? "Final result" : "Projected end"}</p>
              <p className="text-lg font-semibold text-gray-900">{completedDays === 0 ? "–" : money(m.projected)}</p>
              <p className={`text-xs mt-1 ${m.projectedPct >= 100 ? "text-emerald-600" : "text-gray-500"}`}>
                {completedDays === 0 ? "Needs one completed day" : `${m.projectedPct.toFixed(1)}% of budget at the current run rate`}
              </p>
            </div>
            <div className="p-4 bg-white/50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Timeline</p>
              <p className="text-lg font-semibold text-gray-900">
                {status === "after" ? "Completed" : status === "before" ? `Starts 1 ${MONTH_SHORT[MONTH]}` : `${completedDays} day${completedDays === 1 ? "" : "s"} in · ${daysInMonth - completedDays} left`}
              </p>
              <p className="text-xs text-gray-500 mt-1">{countdown}</p>
            </div>
          </div>
        </Card>

        {/* ---------- Cumulative pacing ---------- */}
        <Card updating={isUpdating}>
          <CardTitle icon={Activity} title="Cumulative GP vs Pace" sub={`Running total of GP ${metricLabel} against the straight-line pace to budget`} />
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.rows} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                {bfcmArea}
                {xAxis}
                <YAxis tickFormatter={axisK} tick={AXIS_TICK} stroke="#cbd5e1" width={48} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: any, name: string) => [v == null ? "–" : money(v), name]}
                />
                <Legend verticalAlign="top" align="right" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cumTarget" name="Pace to budget" stroke={TARGET} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="cumActual" name={`Actual GP ${metricLabel}`} stroke={DARK} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ---------- Daily charts carried over from Sales Health ---------- */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {dailyCharts.map((c) => (
            <Card key={c.title} updating={isUpdating}>
              <CardTitle icon={c.icon} title={c.title} sub={c.sub} />
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.rows} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    {bfcmArea}
                    {xAxis}
                    <YAxis tickFormatter={c.axis} tick={AXIS_TICK} stroke="#cbd5e1" width={44} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={tooltipStyle}
                      formatter={(v: any, _n: string, item: any) => [v == null ? "–" : c.fmt(v), item?.payload?.isToday ? "Today (live)" : "Actual"]}
                    />
                    <ReferenceLine y={c.ref} stroke={TARGET} strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: c.refLabel, position: "insideTopRight", fontSize: 11, fill: "#475569" }} />
                    <Bar dataKey={c.dataKey as string} radius={[4, 4, 0, 0]} maxBarSize={22} name="Actual">
                      {m.rows.map((r) => (
                        <Cell key={r.day} fill={r.isToday ? DARK : ACCENT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>

        {/* ---------- Leads ---------- */}
        <div className="rounded-2xl shadow-lg p-5 md:p-6 relative border-2 bg-gradient-to-br from-[#fff4ee] to-white" style={{ borderColor: ACCENT }}>
          <UpdatingBadge isUpdating={isFeedUpdating || isUpdating} />
          <CardTitle
            icon={Users}
            title="Leads"
            sub={`Contacts added to the HubSpot ${feed ? `“${leads.listName}” list` : "master list"} each day, plus inbound sales calls`}
            right={
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-white shrink-0" style={{ backgroundColor: DARK }}>
                Highlight
              </span>
            }
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white border border-gray-100 col-span-2 lg:col-span-1">
              <p className="text-sm font-medium text-gray-600 mb-1">New leads this month</p>
              <p className="text-4xl font-extrabold tracking-tight" style={{ color: DARK, fontFamily: "'Montserrat', sans-serif" }}>
                {feed ? leads.added.toLocaleString() : "–"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {!leads.latest
                  ? "Waiting for HubSpot feed"
                  : leads.cleanup < 0
                    ? `Net list change ${signed(leads.net)} after ${Math.abs(leads.cleanup).toLocaleString()} removed in list clean-up · list ${leads.latest.listSize.toLocaleString()}`
                    : `List size ${leads.latest.listSize.toLocaleString()}`}
              </p>
            </div>
            <Tile
              className="bg-white"
              label="Latest day"
              value={leads.latest ? (leads.latest.newLeads < 0 ? `${signed(leads.latest.newLeads)} net` : signed(leads.latest.newLeads)) : "–"}
              sub={leads.latest ? new Date(leads.latest.date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }) : undefined}
            />
            <Tile
              className="bg-white"
              label="Avg new leads / day"
              value={leads.month.length ? leads.avg.toFixed(1) : "–"}
              sub={
                leads.prevAvg ? (
                  <span className={leads.avg >= leads.prevAvg ? "text-emerald-600" : "text-red-500"}>
                    {leads.avg >= leads.prevAvg ? "▲" : "▼"} vs {leads.prevAvg.toFixed(1)} / day in {MONTH_SHORT[MONTH - 1]}
                  </span>
                ) : undefined
              }
            />
            <Tile
              className="bg-white"
              label="Inbound sales calls"
              value={m.inboundTotal.toLocaleString()}
              sub={status === "live" ? `${m.todayInbound} today · GAF DATA sheet` : "GAF DATA sheet"}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">New leads per day</p>
              <p className="text-xs text-gray-500 mb-3">Contacts added to the list each day. Clean-up days (more removed than added) show no bar; hover for the count removed</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    {bfcmArea}
                    {xAxis}
                    <YAxis tick={AXIS_TICK} stroke="#cbd5e1" width={36} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={tooltipStyle}
                      formatter={(v: any, _n: string, item: any) => [
                        v == null ? "–" : item?.payload?.leadCleanup ? `${v} (list clean-up removed ${item.payload.leadCleanup.toLocaleString()})` : v.toLocaleString(),
                        "New leads",
                      ]}
                    />
                    <Bar dataKey="newLeads" radius={[4, 4, 0, 0]} maxBarSize={22} name="New leads">
                      {m.rows.map((r) => (
                        <Cell key={r.day} fill={r.isToday ? DARK : ACCENT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5"><PhoneIncoming className="w-4 h-4" /> Inbound sales calls per day</p>
              <p className="text-xs text-gray-500 mb-3">Genuine sales conversations only, same rule as Sales Health</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={m.rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    {bfcmArea}
                    {xAxis}
                    <YAxis tick={AXIS_TICK} stroke="#cbd5e1" width={36} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tooltipStyle} formatter={(v: any) => [v == null ? "–" : v.toLocaleString(), "Inbound sales calls"]} />
                    <Bar dataKey="inboundCalls" radius={[4, 4, 0, 0]} maxBarSize={22} name="Inbound sales calls">
                      {m.rows.map((r) => (
                        <Cell key={r.day} fill={r.isToday ? DARK : ACCENT} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Products ---------- */}
        <Card updating={isFeedUpdating}>
          <CardTitle icon={Trophy} title="Top Performing Products" sub={`Shopify revenue, last 7 days${feed?.productsThrough ? ` to ${new Date(feed.productsThrough + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : ""}`} />
          {products.top.length > 0 ? (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                    <th className="px-2 py-2 font-semibold">#</th>
                    <th className="px-2 py-2 font-semibold">Product</th>
                    <th className="px-2 py-2 font-semibold text-right">Revenue 7d</th>
                    <th className="px-2 py-2 font-semibold text-right">Orders</th>
                    <th className="px-2 py-2 font-semibold text-right hidden md:table-cell">Sessions</th>
                    <th className="px-2 py-2 font-semibold text-right hidden md:table-cell">Conv. rate</th>
                    <th className="px-2 py-2 font-semibold text-right hidden lg:table-cell">Revenue 30d</th>
                    <th className="px-2 py-2 font-semibold w-[18%] hidden lg:table-cell"><span className="sr-only">Share</span></th>
                  </tr>
                </thead>
                <tbody>
                  {products.top.map((p, i) => {
                    const max = products.top[0].revenue || 1;
                    const r30 = products.rev30.get(p.handle || p.title)?.revenue || 0;
                    return (
                      <tr key={p.handle || p.title} className="border-b border-gray-50 hover:bg-gray-50/70">
                        <td className="px-2 py-2.5 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-2.5 min-w-[180px]">
                          <a href={p.handle ? `${SITE}${p.handle}` : undefined} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:underline line-clamp-1" title={p.title}>
                            {p.title}
                          </a>
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{money(p.revenue)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{p.orders.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums hidden md:table-cell">{p.sessions.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums hidden md:table-cell">{p.cvr.toFixed(2)}%</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-gray-500 hidden lg:table-cell">{money(r30)}</td>
                        <td className="px-2 py-2.5 hidden lg:table-cell">
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(p.revenue / max) * 100}%`, backgroundColor: ACCENT }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">{isFeedUpdating ? "Loading products…" : "No product sales in the feed yet"}</div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card updating={isFeedUpdating}>
            <CardTitle icon={TrendingUp} title="Trending Up" sub="Last 7 days revenue vs the weekly average of the 3 weeks before" />
            <TrendList rows={products.up} direction="up" />
          </Card>
          <Card updating={isFeedUpdating}>
            <CardTitle icon={TrendingDown} title="Trending Down" sub="Last 7 days revenue vs the weekly average of the 3 weeks before" />
            <TrendList rows={products.down} direction="down" />
          </Card>
        </div>

        {/* ---------- Content, last 7 days ---------- */}
        <Card updating={isFeedUpdating}>
          <CardTitle icon={Heart} title="Top Organic Content" sub="Instagram posts published in the last 7 days, ranked by interactions" />
          {content.organic.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1 xl:grid xl:grid-cols-5 xl:overflow-visible">
              {content.organic.map((p, i) => <PostCard key={p.permalink || i} post={p} index={i} />)}
            </div>
          ) : (
            <div className="w-full text-center py-10 text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              {isFeedUpdating ? "Loading posts…" : "No Instagram posts published in the last 7 days."}
            </div>
          )}
        </Card>

        <Card updating={isFeedUpdating}>
          <CardTitle
            icon={MousePointerClick}
            title="Top Paid Content"
            sub="Meta ads, last 7 days, ranked by link clicks"
            right={
              <a href={PERF_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 shrink-0">
                Performance dashboard <ExternalLink className="w-3 h-3" />
              </a>
            }
          />
          {content.paid.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-1 px-1 xl:grid xl:grid-cols-5 xl:overflow-visible">
              {content.paid.map((a, i) => <AdCard key={a.adId || i} ad={a} index={i} />)}
            </div>
          ) : (
            <div className="w-full text-center py-10 text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              {isFeedUpdating ? "Loading ads…" : "No Meta ad delivery in the last 7 days."}
            </div>
          )}
        </Card>

        <p className="text-xs text-gray-400 leading-relaxed px-1">
          Sales, budget, margin, discount, traffic and inbound calls: <a className="underline hover:text-gray-600" href={DATA_SOURCE_URL} target="_blank" rel="noreferrer">GAF DATA sheet</a> (same as Sales Health), checked every 5 minutes.
          {" "}Leads, products and content: GAF performance feed{feedAt && !isNaN(feedAt.getTime()) ? `, built ${feedAt.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""} (rebuilt each morning), plus the GAF IG feed sheet.
          {" "}BFCM band marks Black Friday to Cyber Monday.
        </p>
      </div>
    </div>
  );
}
