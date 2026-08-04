import React, { useState, useEffect, useMemo } from 'react';
import {
    Compass, Heart, Mountain, Star, MapPin, Target, Flag, Rocket, Loader2,
    ShieldCheck, AlertTriangle, Lightbulb, TrendingUp, Users, Settings, CheckCircle2,
    PhoneIncoming, Info,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine, Label,
} from 'recharts';
import { GAF_COLORS } from '../constants';
import { fetchBHAGData } from '../services/dataService';
import { BHAGData } from '../types';

// Home Gym Builder BHAG tracker. Reads a committed JSON refreshed from the
// read-only NetSuite HGB recalc (three-path rule, locked w/ Adam 4 Aug 2026).
// Data path is relative to the dashboard base so it works under /gaf-master-dashboard/.
interface HGBTrackerData { count: number; target: number; asOf: string; window: string; note?: string; }
const HGBTracker: React.FC = () => {
    const [t, setT] = useState<HGBTrackerData | null>(null);
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}hgb-tracker.json?cb=${Date.now()}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setT(d))
            .catch(() => {});
    }, []);
    if (!t) return null;
    const pct = Math.max(0, Math.min(100, (t.count / t.target) * 100));
    return (
        <div className="bg-gradient-to-br from-orange-600 to-orange-500 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
            <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-xs font-bold uppercase tracking-widest mb-5">
                    <Target size={12} /> Home Gym Builder Tracker
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                    <div>
                        <div className="text-5xl md:text-6xl font-black tracking-tight font-montserrat leading-none">{t.count.toLocaleString()}</div>
                        <div className="text-sm text-orange-50/90 font-semibold mt-2">Home Gym builds · {t.window}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl md:text-3xl font-black font-montserrat leading-none">{t.target.toLocaleString()}</div>
                        <div className="text-xs text-orange-50/80 font-semibold mt-1">BHAG target by 2030</div>
                    </div>
                </div>
                <div className="h-3 w-full bg-black/25 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs text-orange-50/80 font-medium">
                    <span>{pct.toFixed(1)}% of the 2030 BHAG (run-rate)</span>
                    <span>Updated {t.asOf}</span>
                </div>
                {t.note && <div className="text-[11px] text-orange-50/70 mt-3 leading-snug">{t.note}</div>}
            </div>
        </div>
    );
};

// Published-to-web copy of "GAF - One Page Plan (Scaling Up Scoreboard)".
// If this tab ever shows the fallback snapshot, the first thing to check is that the
// doc is still File > Share > Publish to web. An unpublished doc returns 401 to the
// proxy, which is indistinguishable from a proxy outage from the browser's side.
const DOC_PUB_URL =
    "https://docs.google.com/document/d/e/2PACX-1vRKUADNpV9pz1kwD44mxS2sdmTKqhQ8E64f9d8AnODzC1ekkZeL6OU9ND6OrofrYeQFuJfiOJMlSgzg/pub";

// The only two numbers on this tab that are NOT in the doc. The AOV baseline has no
// field in the Scaling Up template, so the target is derived from it and whatever the
// doc's Green band says (4% today) rather than being frozen at $1512. If Josh adds a
// baseline row to the doc, read it here and delete the constant.
const AOV_BASELINE = 1454;
const TARGET_CALLS = 40;

interface Thrust { title: string; desc: string; }
interface Initiative { text: string; started: string; status: string; }
interface CriticalNumber {
    name: string; owner: string;
    superGreen: string; green: string; yellow: string; red: string; current: string;
}
interface KeyValue { key: string; value: string; }

interface OpspData {
    period: string;
    quarterLabel: string;
    coreValues: string[];
    purpose: string;
    bhag: string;
    bhagTargets: string[];
    brandPromises: string[];
    brandPromiseKpis: string[];
    horizonYear: string;
    horizonRevenue: string;
    keyThrusts: Thrust[];
    profitX: string;
    fy27Revenue: string;
    fy27GrossProfit: string;
    fy27GPMargin: string;
    initiatives: Initiative[];
    actions: string[];
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    criticalNumbers: CriticalNumber[];
    theme: KeyValue[];
    people: KeyValue[];
    process: KeyValue[];
    sandbox: KeyValue[];
}

// Snapshot of the doc as at 03/08/2026. Only ever rendered if both proxies fail —
// every field below is overwritten by the live parse on a normal load.
const FALLBACK: OpspData = {
    period: "01/04/2026 - 30/06/2026 (Current)",
    quarterLabel: "Quarterly (Q1 FY27)",
    coreValues: ["PEOPLE", "NIMBAGILITY", "CONTINUOUS IMPROVEMENT", "COLLABORATION", "EMPATHY", "INCLUSIVITY"],
    purpose: "Improve lives through fitness and wellness",
    bhag: "Design and deliver 10,000+ home gyms annually by 2030",
    bhagTargets: [],
    brandPromises: [
        "Your Gym Designed for your space in real time",
        "Love your design or our fitness consultants will re-design it with you - until you love it",
    ],
    brandPromiseKpis: [],
    horizonYear: "FY30",
    horizonRevenue: "$40,300,000",
    keyThrusts: [],
    profitX: "Contribution Margin per Order (Revenue - COGS - Freight, Returns - CAC)",
    fy27Revenue: "$25,239,066.87",
    fy27GrossProfit: "$ 9,387,622.41",
    fy27GPMargin: "37.19%",
    initiatives: [],
    actions: [],
    strengths: [], weaknesses: [], opportunities: [], threats: [],
    criticalNumbers: [],
    theme: [], people: [], process: [], sandbox: [],
};

/* ------------------------------------------------------------------ parsing */

// Google publishes the doc as a SINGLE line with no newlines, so any parse that
// splits on '\n' silently matches nothing and every field falls back to the
// snapshot. Parse the DOM structure instead: newline-independent and deterministic.
function parseDoc(htmlText: string): OpspData {
    const doc = new DOMParser().parseFromString(htmlText, 'text/html');
    doc.querySelectorAll('script, style, head').forEach((el) => el.remove());

    const txt = (el: Element | null | undefined) =>
        (el?.textContent || '').replace(/\s+/g, ' ').trim();

    const blocks = Array.from(doc.querySelectorAll('p, h1, h2, h3, h4, li'))
        .map((el) => txt(el))
        .filter(Boolean);

    const idxOf = (re: RegExp, from = 0) =>
        blocks.findIndex((b, i) => i >= from && re.test(b));

    const valueAfter = (re: RegExp, from = 0) => {
        const i = idxOf(re, from);
        return i !== -1 ? (blocks[i + 1] || '') : '';
    };

    // Blocks strictly between two headings — used for the free-text lists
    // (brand promises, BHAG sub-targets, actions) that aren't in tables.
    const between = (start: RegExp, end: RegExp): string[] => {
        const s = idxOf(start);
        if (s === -1) return [];
        const e = idxOf(end, s + 1);
        return blocks.slice(s + 1, e === -1 ? undefined : e);
    };

    // A cell wrapped over several lines in the doc becomes several <p> children, and
    // textContent concatenates them with no separator ("Improve Revel Supply and" +
    // "Resilence" reads as "andResilence"). Join the paragraphs with a space instead.
    const cellText = (c: Element) => {
        const paras = Array.from(c.querySelectorAll('p')).map((p) => txt(p)).filter(Boolean);
        return paras.length ? paras.join(' ') : txt(c);
    };

    // Rows of the first table that FOLLOWS a heading, header row dropped.
    const tableAfter = (re: RegExp): string[][] => {
        const heading = Array.from(doc.querySelectorAll('h1,h2,h3,h4,p,span'))
            .find((el) => re.test(txt(el)));
        if (!heading) return [];
        const tbl = Array.from(doc.querySelectorAll('table')).find(
            (t) => heading.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (!tbl) return [];
        return Array.from(tbl.querySelectorAll('tr'))
            .slice(1)
            .map((row) => Array.from(row.querySelectorAll('td')).map((c) => cellText(c)));
    };

    // Numbered list tables (#, Value) — the shape used by core values, thrusts and
    // all four SWOT quadrants. Rows with a number but no text are empty placeholders.
    const numberedList = (re: RegExp): string[] =>
        tableAfter(re)
            .filter((cells) => cells.length >= 2 && cells[1])
            .map((cells) => cells[1]);

    const keyValues = (re: RegExp): KeyValue[] =>
        tableAfter(re)
            .filter((cells) => cells.length >= 2 && cells[0])
            .map((cells) => ({ key: cells[0], value: cells[1] || '' }));

    const out: OpspData = { ...FALLBACK };

    const period = blocks.find((b) => /^Period:/i.test(b));
    if (period) out.period = period.replace(/^Period:\s*/i, '');

    const qLabel = blocks.find((b) => /^Quarterly \(/i.test(b));
    if (qLabel) out.quarterLabel = qLabel;

    const coreValues = numberedList(/Core Values/i);
    if (coreValues.length) out.coreValues = coreValues;

    const purpose = valueAfter(/^Purpose \(Why\)/i);
    if (purpose) out.purpose = purpose;

    const bhag = valueAfter(/^BHAG/i);
    if (bhag) out.bhag = bhag;

    const bhagTargets = between(/^BHAG/i, /^Brand Promises$/i).slice(1);
    if (bhagTargets.length) out.bhagTargets = bhagTargets;

    const promises = between(/^Brand Promises$/i, /^Brand Promises KPIs/i);
    if (promises.length) out.brandPromises = promises;

    const kpis = between(/^Brand Promises KPIs/i, /^Three to Five Years/i);
    if (kpis.length) out.brandPromiseKpis = kpis;

    // 3-5yr targets table: most rows are blank placeholders, so take the LAST row
    // that actually carries a dollar figure rather than assuming a fixed year.
    const horizon = tableAfter(/^Targets - FY/i)
        .filter((c) => c.length >= 2 && /\$[\d,]+/.test(c[1]))
        .pop();
    if (horizon) { out.horizonYear = horizon[0]; out.horizonRevenue = horizon[1]; }

    // Thrusts are written "Title- desc", "Title - desc" and "Title– desc" in the same
    // table, and one row carries a stray "3. " prefix. Normalise both.
    const thrusts = numberedList(/^Key Thrusts/i).map((raw) => {
        const t = raw.replace(/^\d+\.\s*/, '').trim();
        const m = t.match(/^(.*?)\s*[-–]\s*(.*)$/);
        return m ? { title: m[1].trim(), desc: m[2].trim() } : { title: t, desc: '' };
    });
    if (thrusts.length) out.keyThrusts = thrusts;

    const profitX = valueAfter(/^Profit\/X/i);
    if (profitX) out.profitX = profitX;

    for (const cells of tableAfter(/^One Year - Goals FY/i)) {
        if (cells.length < 2) continue;
        const cat = cells[0].toUpperCase();
        if (cat === 'REVENUE') out.fy27Revenue = cells[1];
        else if (cat === 'GROSS PROFIT') out.fy27GrossProfit = cells[1];
        else if (cat === 'GROSS PROFIT %') out.fy27GPMargin = cells[1];
    }

    const initiatives = tableAfter(/^Key Initiatives/i)
        .filter((c) => c.length >= 2 && c[1])
        .map((c) => ({ text: c[1], started: c[2] || '', status: c[4] || '' }));
    if (initiatives.length) out.initiatives = initiatives;

    const actions = between(/^Actions \(Support Values/i, /^SWOT Analysis/i);
    if (actions.length) out.actions = actions;

    out.strengths = numberedList(/^Strengths$/i);
    out.weaknesses = numberedList(/^Weaknesses$/i);
    out.opportunities = numberedList(/^Opportunities$/i);
    out.threats = numberedList(/^Trends \/ Threats$/i);

    // The doc currently splits one metric across two rows: row 1 carries the name and
    // bands, row 2 repeats the bands with the Current value and no name. Treat a row
    // with a blank name as a continuation and fold its values into the row above.
    const cnRows = tableAfter(/^Critical Numbers$/i).filter((c) => c.some(Boolean));
    const criticalNumbers: CriticalNumber[] = [];
    for (const c of cnRows) {
        const row: CriticalNumber = {
            name: c[0] || '', owner: c[1] || '',
            superGreen: c[2] || '', green: c[3] || '', yellow: c[4] || '', red: c[5] || '',
            current: c[6] || '',
        };
        const prev = criticalNumbers[criticalNumbers.length - 1];
        if (!row.name && prev) {
            (Object.keys(row) as (keyof CriticalNumber)[]).forEach((k) => {
                if (row[k] && !prev[k]) prev[k] = row[k];
            });
            if (row.current) prev.current = row.current;
        } else if (row.name) {
            criticalNumbers.push(row);
        }
    }
    out.criticalNumbers = criticalNumbers;

    out.theme = keyValues(/^Theme \(Qtr\/Annual\)/i);
    out.people = keyValues(/^People \(Reputation Drivers\)/i);
    out.process = keyValues(/^Process \(Productivity Drivers\)/i);
    out.sandbox = keyValues(/^Sandbox \/ Ideal Client/i);

    return out;
}

/* ------------------------------------------------------------ band scoring */

const num = (s: string) => {
    const m = (s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : NaN;
};

// Direction is inferred from the bands themselves (superGreen vs red) rather than
// assumed, so a lower-is-better metric added later scores correctly without a code change.
function bandFor(cn: CriticalNumber): { label: string; tone: 'super' | 'green' | 'yellow' | 'red' | 'none' } {
    const cur = num(cn.current);
    const sg = num(cn.superGreen), g = num(cn.green), y = num(cn.yellow), r = num(cn.red);
    if (isNaN(cur) || isNaN(g)) return { label: 'Not set', tone: 'none' };
    const higherIsBetter = isNaN(sg) || isNaN(r) ? true : sg >= r;
    const meets = (t: number) => (isNaN(t) ? false : higherIsBetter ? cur >= t : cur <= t);
    if (meets(sg)) return { label: 'Super Green', tone: 'super' };
    if (meets(g)) return { label: 'Green', tone: 'green' };
    if (meets(y)) return { label: 'Yellow', tone: 'yellow' };
    return { label: 'Red', tone: 'red' };
}

const TONE: Record<string, string> = {
    super: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/20 text-red-300 border-red-500/30',
    none: 'bg-white/10 text-gray-400 border-white/15',
};

/* ---------------------------------------------------------------- building blocks */

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; sub?: string }> = ({ icon, title, sub }) => (
    <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-gray-100 text-gray-700 rounded-lg">{icon}</div>
        <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{title}</h3>
            {sub && <p className="text-xs text-gray-500 font-medium">{sub}</p>}
        </div>
    </div>
);

const SwotCard: React.FC<{
    title: string; items: string[]; icon: React.ReactNode; accent: string;
}> = ({ title, items, icon, accent }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
            <div className={`p-1.5 rounded-lg ${accent}`}>{icon}</div>
            <h4 className="font-bold text-gray-900">{title}</h4>
            <span className="ml-auto text-xs font-bold text-gray-400">{items.length}</span>
        </div>
        {items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Not yet entered in the source document.</p>
        ) : (
            <ul className="space-y-2">
                {items.map((it, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                        {it}
                    </li>
                ))}
            </ul>
        )}
    </div>
);

// The Scaling Up template writes an unfilled field several ways: "Not set",
// "Not entered", "No theme entered", "No items entered." Treat them all as empty
// so a placeholder never renders as if it were the actual theme.
const PLACEHOLDER = /^(not (set|entered)|no [a-z ]+ entered\.?)$/i;

const KeyValueList: React.FC<{ rows: KeyValue[] }> = ({ rows }) => (
    <div className="space-y-3">
        {rows.length === 0 && <p className="text-xs text-gray-400 italic">Not yet entered in the source document.</p>}
        {rows.map((r, i) => (
            <div key={i} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{r.key}</div>
                <div className="text-sm text-gray-800 font-medium leading-snug">
                    {r.value && !PLACEHOLDER.test(r.value)
                        ? r.value
                        : <span className="text-gray-400 italic font-normal">Not set</span>}
                </div>
            </div>
        ))}
    </div>
);

/* ------------------------------------------------------------------ component */

export default function OPSPDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<OpspData | null>(null);
    const [isLive, setIsLive] = useState(true);
    const [bhagData, setBhagData] = useState<BHAGData | null>(null);

    useEffect(() => {
        let cancelled = false;

        // The AOV and inbound-call charts read their own CSV feeds. Fire and forget:
        // they must never block or fail the OPSP text render, and both memos below
        // already handle a null result.
        fetchBHAGData()
            .then((res) => { if (!cancelled) setBhagData(res); })
            .catch((e) => console.warn("BHAG fetch failed", e));

        // Google serves the doc cross-origin, so it has to be proxied. allorigins is
        // flaky (rate-limits, hangs), which would otherwise leave the tab stuck on the
        // loader, so race a timeout and fall through to a second proxy before degrading.
        const proxies = (url: string) => [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        ];

        const viaProxy = async (proxyUrl: string): Promise<string | null> => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            try {
                const res = await fetch(proxyUrl, { signal: controller.signal });
                if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
                const ct = res.headers.get('content-type') || '';
                // allorigins wraps the payload as JSON { contents }; corsproxy returns raw HTML.
                if (ct.includes('application/json')) return (await res.json()).contents || null;
                return await res.text();
            } finally {
                clearTimeout(timer);
            }
        };

        (async () => {
            const url = `${DOC_PUB_URL}?_t=${Date.now()}`;
            let html: string | null = null;
            for (const p of proxies(url)) {
                try {
                    html = await viaProxy(p);
                    if (html) break;
                } catch (e) {
                    console.warn("OPSP proxy failed, trying next.", e);
                }
            }
            if (cancelled) return;
            if (!html) {
                console.warn("All OPSP proxies failed; rendering fallback snapshot.");
                setData(FALLBACK);
                setIsLive(false);
                return;
            }
            try {
                setData(parseDoc(html));
            } catch (e) {
                console.warn("OPSP parse failed; rendering fallback snapshot.", e);
                setData(FALLBACK);
                setIsLive(false);
            }
        })().finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const weeklyCallsData = useMemo(() => {
        if (!bhagData?.inboundCallData) return [];
        const weeks: Record<string, { weekStart: Date; calls: number; daysData: number }> = {};
        bhagData.inboundCallData.forEach((day) => {
            const dt = new Date(day.date);
            const dow = dt.getDay();
            const monday = new Date(dt.setDate(dt.getDate() - dow + (dow === 0 ? -6 : 1)));
            monday.setHours(0, 0, 0, 0);
            const key = monday.toISOString();
            if (!weeks[key]) weeks[key] = { weekStart: monday, calls: 0, daysData: 0 };
            weeks[key].calls += day.calls;
            weeks[key].daysData += 1;
        });
        return Object.values(weeks)
            .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
            .slice(-12)
            .map((w) => {
                const isCurrent = (Date.now() - w.weekStart.getTime()) < 7 * 24 * 60 * 60 * 1000;
                const projected = isCurrent && w.daysData > 0 && w.daysData < 7
                    ? Math.round((w.calls / w.daysData) * 7)
                    : w.calls;
                return {
                    shortName: w.weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
                    calls: w.calls, projected, isCurrent,
                };
            });
    }, [bhagData]);

    const dailyAOVData = useMemo(() => {
        if (!bhagData?.aovData) return [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        return bhagData.aovData
            .filter((x) => { const dd = new Date(x.date); dd.setHours(0, 0, 0, 0); return dd.getTime() < today.getTime(); })
            .slice(-30)
            .map((x) => ({ date: x.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), aov: x.aov }));
    }, [bhagData]);

    const currentMonthToDateAOV = useMemo(() => {
        if (!bhagData?.aovData) return 0;
        const now = new Date();
        const mtd = bhagData.aovData.filter((x) => x.date.getMonth() === now.getMonth() && x.date.getFullYear() === now.getFullYear());
        const orders = mtd.reduce((sum, x) => sum + x.orders, 0);
        return orders > 0 ? mtd.reduce((sum, x) => sum + x.revenue, 0) / orders : 0;
    }, [bhagData]);

    const currentWeekCalls = weeklyCallsData.length ? weeklyCallsData[weeklyCallsData.length - 1] : null;

    // Derived from the doc's own Green band on the AOV critical number, so changing
    // "4%" in the doc moves the chart's target line with it.
    const aovTarget = useMemo(() => {
        const cn = (data?.criticalNumbers || []).find((c) => /AOV/i.test(c.name));
        const pct = cn ? num(cn.green) : NaN;
        return isNaN(pct) ? AOV_BASELINE : AOV_BASELINE * (1 + pct / 100);
    }, [data]);

    if (isLoading || !data) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                <p className="text-gray-500 font-medium">Fetching Live OPSP Data...</p>
            </div>
        );
    }

    const d = data;

    return (
        <div className="min-h-screen bg-[#f8f8fa] font-sans pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
                <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-orange-100 rounded-xl text-orange-700 shrink-0">
                            <Compass size={24} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900 truncate">
                                One Page Strategic Plan
                            </h1>
                            <p className="text-xs text-gray-500 font-medium truncate">
                                {d.quarterLabel.replace(/^Quarterly\s*/i, '').replace(/[()]/g, '')} • {d.period}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {!isLive && (
                            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg">
                                <AlertTriangle size={12} /> Showing cached snapshot
                            </span>
                        )}
                        <a
                            href={DOC_PUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm hidden sm:block"
                        >
                            View Live Source Document
                        </a>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

                {/* PURPOSE & BHAG HERO */}
                <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest mb-4">
                                <Heart size={12} className="text-orange-400" /> Purpose (Why)
                            </div>
                            <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-8 font-montserrat">
                                {d.purpose}
                            </h2>

                            <div className="uppercase tracking-widest text-[10px] text-gray-400 font-bold mb-3">
                                Brand Promises
                            </div>
                            <div className="space-y-3 border-l-2 border-orange-500 pl-4">
                                {d.brandPromises.map((p, i) => (
                                    <div key={i}>
                                        <p className="text-sm md:text-base text-gray-200 font-semibold leading-snug">{p}</p>
                                        {d.brandPromiseKpis[i] && (
                                            <p className="text-xs text-gray-400 mt-1 leading-snug">{d.brandPromiseKpis[i]}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="md:border-l border-white/10 md:pl-8 flex flex-col justify-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest w-max mb-4">
                                <Mountain size={12} className="text-orange-400" /> BHAG (10-30 Yrs)
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200 font-montserrat mb-6">
                                {d.bhag}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {d.bhagTargets.map((t, i) => (
                                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
                                        <div className="text-sm font-bold text-white leading-snug">{t}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* HOME GYM BUILDER BHAG TRACKER */}
                <HGBTracker />

                {/* QUARTERLY CRITICAL NUMBERS + THEME */}
                <div className="bg-gray-900 rounded-2xl shadow-md p-6 md:p-8 text-white relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-gray-500" />

                    <div className="flex items-center gap-2 mb-8">
                        <div className="p-2 bg-white/10 text-white rounded-lg"><Rocket size={20} /></div>
                        <h3 className="font-bold text-xl">Critical Numbers • {d.quarterLabel.replace(/^Quarterly\s*/i, '').replace(/[()]/g, '')}</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* A fixed 2-col grid leaves a dead half-width hole when the doc
                            carries a single critical number, so only split above one. */}
                        <div className={`lg:col-span-2 grid gap-4 grid-cols-1 ${d.criticalNumbers.length > 1 ? 'md:grid-cols-2' : ''}`}>
                            {d.criticalNumbers.length === 0 && (
                                <p className="text-sm text-gray-400 italic">No critical numbers entered in the source document.</p>
                            )}
                            {d.criticalNumbers.map((cn, i) => {
                                const band = bandFor(cn);
                                return (
                                    <div key={i} className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
                                        <div className="flex justify-between items-start gap-3 mb-4">
                                            <div>
                                                <div className="font-bold text-lg leading-tight">{cn.name}</div>
                                                {cn.owner && <div className="text-xs text-gray-400 mt-1">{cn.owner}</div>}
                                            </div>
                                            <div className={`px-2 py-1 text-xs font-bold rounded border shrink-0 ${TONE[band.tone]}`}>
                                                {band.label}
                                            </div>
                                        </div>
                                        <div className="border-t border-white/10 pt-4">
                                            <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Current</div>
                                            <div className="text-3xl font-black mb-4">
                                                {cn.current || <span className="text-base font-medium text-gray-500">Not recorded</span>}
                                            </div>
                                            <div className="grid grid-cols-4 gap-1.5 text-center">
                                                {([['Super', cn.superGreen], ['Green', cn.green], ['Yellow', cn.yellow], ['Red', cn.red]] as const).map(([lbl, val]) => (
                                                    <div key={lbl} className="bg-white/5 rounded-lg py-2">
                                                        <div className="text-[9px] uppercase text-gray-500 font-bold">{lbl}</div>
                                                        <div className="text-xs font-bold text-gray-200">{val || '—'}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-4">Theme (Qtr / Annual)</div>
                            {d.theme.length === 0 && <p className="text-sm text-gray-400 italic">Not entered.</p>}
                            {d.theme.map((t, i) => (
                                <div key={i} className="mb-4 last:mb-0">
                                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{t.key}</div>
                                    <div className={`leading-snug ${t.key.toLowerCase() === 'theme'
                                        ? 'text-lg font-black text-orange-300 font-montserrat'
                                        : 'text-sm text-gray-200 font-medium'}`}>
                                        {t.value && !PLACEHOLDER.test(t.value)
                                            ? t.value
                                            : <span className="text-gray-500 italic font-normal text-sm">Not set</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* TREND DETAIL — the two critical numbers that have a live daily feed
                    behind them. The headline figures above come from the doc; these
                    charts come from the AOV and inbound-call CSVs. */}
                <div>
                    <div className="flex items-center gap-2 mb-5 mt-2">
                        <TrendingUp className="text-orange-600" size={22} />
                        <h2 className="text-xl font-bold text-gray-900">Trend Detail</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-green-100 text-green-700 rounded-lg"><TrendingUp size={16} /></div>
                                        <h3 className="font-bold text-gray-900">Average Order Value</h3>
                                        <a
                                            href="https://docs.google.com/spreadsheets/d/1nE1DXvDAg3ozg4iSoSFL4YXAk9oVo2Etbtz9qJZ4U1g/edit?gid=176781390#gid=176781390"
                                            target="_blank" rel="noopener noreferrer"
                                            className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                                            title="View source spreadsheet"
                                        ><Info size={16} /></a>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-9">
                                        Baseline ${AOV_BASELINE} <span className="mx-1">•</span>
                                        Target <span className="font-bold text-green-600">${aovTarget.toFixed(0)}</span>
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-2xl font-bold text-gray-900">
                                        ${currentMonthToDateAOV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium mb-1">Month to date</div>
                                    <div className={`text-xs font-bold ${currentMonthToDateAOV >= aovTarget ? 'text-green-600' : 'text-red-500'}`}>
                                        {currentMonthToDateAOV >= aovTarget
                                            ? 'On track'
                                            : `${((currentMonthToDateAOV / aovTarget) * 100).toFixed(1)}% to target`}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart data={dailyAOVData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tickFormatter={(v) => `$${v}`} domain={['auto', 'auto']} tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(val: number) => [`$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'Daily AOV']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        />
                                        <ReferenceLine y={aovTarget} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                                            <Label value={`Target $${aovTarget.toFixed(0)}`} position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                                        </ReferenceLine>
                                        <Bar dataKey="aov" fill={GAF_COLORS.orange} radius={[4, 4, 0, 0]} barSize={20} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg"><PhoneIncoming size={16} /></div>
                                        <h3 className="font-bold text-gray-900">Weekly Inbound Sales Calls</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-9">Maintain {TARGET_CALLS}+ calls per week</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-2xl font-bold text-gray-900">
                                        {currentWeekCalls
                                            ? (currentWeekCalls.isCurrent ? `${currentWeekCalls.calls} (${currentWeekCalls.projected} proj.)` : currentWeekCalls.calls)
                                            : 0}
                                    </div>
                                    <div className={`text-xs font-bold ${currentWeekCalls && currentWeekCalls.projected >= TARGET_CALLS ? 'text-green-600' : 'text-red-500'}`}>
                                        {currentWeekCalls && currentWeekCalls.projected >= TARGET_CALLS ? 'On track' : 'Below target'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart data={weeklyCallsData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                        <XAxis dataKey="shortName" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(val: number, name: string) => [val, name === 'projected' ? 'Projected end of week' : 'Calls so far']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                        />
                                        <ReferenceLine y={TARGET_CALLS} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                                            <Label value={`Target ${TARGET_CALLS}`} position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                                        </ReferenceLine>
                                        <Bar dataKey="calls" fill={GAF_COLORS.blue} radius={[4, 4, 0, 0]} barSize={30} />
                                        <Bar dataKey="projected" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} style={{ opacity: 0.3 }} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOUNDATION ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <SectionHeading icon={<Star size={18} />} title="Core Values" />
                        <div className="flex flex-col gap-2">
                            {d.coreValues.map((val, i) => (
                                <div key={i} className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 text-center">
                                    {val}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
                        <SectionHeading icon={<MapPin size={18} />} title="Sandbox / Ideal Client" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                            <KeyValueList rows={d.sandbox.slice(0, Math.ceil(d.sandbox.length / 2))} />
                            <KeyValueList rows={d.sandbox.slice(Math.ceil(d.sandbox.length / 2))} />
                        </div>
                    </div>
                </div>

                {/* TIMELINE GOALS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-300 p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="flex justify-between items-start gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-gray-100 text-gray-700 rounded-lg"><Target size={18} /></div>
                                <h3 className="font-bold text-gray-900 text-lg">3-5 Years</h3>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">{d.horizonYear} Revenue Target</div>
                                <div className="text-xl font-black text-gray-900">{d.horizonRevenue}</div>
                            </div>
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Key Thrusts / Capabilities</h4>
                        <div className="space-y-3 mb-6">
                            {d.keyThrusts.map((t, i) => (
                                <div key={i} className="flex gap-3 group">
                                    <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                        {i + 1}
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-900 font-bold mb-0.5">{t.title}</div>
                                        {t.desc && <div className="text-xs text-gray-500 leading-snug">{t.desc}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Profit / X</div>
                            <div className="text-sm text-gray-800 font-semibold leading-snug">{d.profitX}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-300 p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="flex justify-between items-start gap-4 mb-6 flex-wrap">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-100 text-orange-700 rounded-lg"><Flag size={18} /></div>
                                <h3 className="font-bold text-gray-900 text-lg">One Year (FY2027)</h3>
                            </div>
                            <div className="flex gap-4 text-right">
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Revenue</div>
                                    <div className="text-lg font-black text-gray-900">{d.fy27Revenue}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Gross Profit</div>
                                    <div className="text-lg font-black text-gray-900">{d.fy27GrossProfit}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">GP %</div>
                                    <div className="text-lg font-black text-orange-700">{d.fy27GPMargin}</div>
                                </div>
                            </div>
                        </div>

                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Key Initiatives (Annual Priorities)</h4>
                        <div className="space-y-3">
                            {d.initiatives.map((init, i) => (
                                <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl hover:bg-orange-50/50 transition-colors border border-transparent hover:border-orange-100">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-700 leading-snug">{init.text}</div>
                                        {(init.started || init.status) && (
                                            <div className="flex gap-3 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                {init.started && <span>Started {init.started}</span>}
                                                {init.status && <span>Status: {init.status}</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SWOT */}
                <div>
                    <div className="flex items-center gap-2 mb-5 mt-2">
                        <Compass className="text-orange-700" size={22} />
                        <h2 className="text-xl font-bold text-gray-900">SWOT Analysis</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SwotCard title="Strengths" items={d.strengths} icon={<ShieldCheck size={16} />} accent="bg-emerald-100 text-emerald-700" />
                        <SwotCard title="Weaknesses" items={d.weaknesses} icon={<AlertTriangle size={16} />} accent="bg-red-100 text-red-700" />
                        <SwotCard title="Opportunities" items={d.opportunities} icon={<Lightbulb size={16} />} accent="bg-amber-100 text-amber-700" />
                        <SwotCard title="Trends / Threats" items={d.threats} icon={<TrendingUp size={16} />} accent="bg-blue-100 text-blue-700" />
                    </div>
                </div>

                {/* SUPPORTING */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <SectionHeading icon={<Users size={18} />} title="People" sub="Reputation drivers" />
                        <KeyValueList rows={d.people} />
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <SectionHeading icon={<Settings size={18} />} title="Process" sub="Productivity drivers" />
                        <KeyValueList rows={d.process} />
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <SectionHeading icon={<CheckCircle2 size={18} />} title="Actions" sub="Support values, purpose, BHAG" />
                        {d.actions.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Not yet entered in the source document.</p>
                        ) : (
                            <ul className="space-y-2.5">
                                {d.actions.map((a, i) => (
                                    <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-snug">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                        {a}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
