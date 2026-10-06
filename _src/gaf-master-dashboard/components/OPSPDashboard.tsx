import React, { useState, useEffect, useMemo } from 'react';
import {
    Compass, Heart, Mountain, Star, MapPin, Target, Flag, Rocket, Loader2,
    ShieldCheck, AlertTriangle, Lightbulb, TrendingUp, Users, Settings, CheckCircle2,
    PhoneIncoming, Info, PencilRuler, ChevronRight, Calendar, FileX, Package, Percent,
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ReferenceLine, Label,
} from 'recharts';
import { GAF_COLORS } from '../constants';
import {
    fetchBHAGData, fetchGCDeadStockTotal, fetchFillRate, fetchIdcGpQuarter,
    FillRateData, IdcGpQuarter,
} from '../services/dataService';
import { BHAGData } from '../types';
import { SourceNote } from './SourceNote';

// Home Gym Builder BHAG tracker (compact, sits inside the BHAG hero).
// Reads a committed JSON refreshed from the read-only NetSuite HGB recalc.
// Shows two pacing numbers: % to target and % elapsed through the BHAG period.
interface HGBTrackerData { count: number; target: number; asOf: string; window: string; periodStart?: string; periodEnd?: string; fy27ToDate?: number; fy26Baseline?: number; fy26SamePoint?: number; note?: string; }
const HGBTracker: React.FC = () => {
    const [t, setT] = useState<HGBTrackerData | null>(null);
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}hgb-tracker.json?cb=${Date.now()}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setT(d))
            .catch(() => {});
    }, []);
    if (!t) return null;
    const toTarget = Math.max(0, Math.min(100, (t.count / t.target) * 100));
    // % elapsed through the BHAG time period (computed live)
    const start = new Date(t.periodStart || '2025-07-01').getTime();
    const end = new Date(t.periodEnd || '2030-12-31').getTime();
    const elapsed = Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
    const behind = toTarget < elapsed - 1;
    const ahead = toTarget > elapsed + 1;
    const paceLabel = behind ? 'behind pace' : ahead ? 'ahead of pace' : 'on pace';
    const paceColor = behind ? 'text-red-300' : ahead ? 'text-green-300' : 'text-orange-200';
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-400/30 text-[10px] font-bold uppercase tracking-widest text-orange-300 mb-3">
                <Target size={11} /> Home Gym Builder Tracker
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black font-montserrat leading-none text-white">{t.count.toLocaleString()}</span>
                <span className="text-lg font-bold text-gray-400">/ {t.target.toLocaleString()}</span>
            </div>
            <div className="text-[11px] text-gray-400 font-semibold mt-1">{t.window}</div>
            <SourceNote text={`Source: NetSuite, via the hgb-tracker GitHub Action · as of ${t.asOf}`} tone="light" className="mt-1" />
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden mt-3 relative">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${toTarget}%` }} />
                <div className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-white" style={{ left: `${elapsed}%` }} title="expected pace" />
            </div>
            <div className="flex items-center justify-between gap-2 mt-2.5 text-[11px] font-bold">
                <span className="text-orange-300">{toTarget.toFixed(0)}% to target</span>
                <span className="text-gray-400">{elapsed.toFixed(0)}% through period</span>
                <span className={paceColor}>{paceLabel}</span>
            </div>
            {t.fy27ToDate != null && t.fy26Baseline ? (() => {
                const yoyPct = t.fy26SamePoint ? Math.round(((t.fy27ToDate! - t.fy26SamePoint) / t.fy26SamePoint) * 100) : null;
                const up = t.fy26SamePoint != null && t.fy27ToDate! >= t.fy26SamePoint;
                const yoyW = Math.max(0, Math.min(100, (t.fy27ToDate! / t.fy26Baseline!) * 100));
                return (
                    <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                            <span className="text-gray-300">FY27 to date</span>
                            <span className="text-white">{t.fy27ToDate!.toLocaleString()} <span className="text-gray-500 font-semibold">/ {t.fy26Baseline!.toLocaleString()} FY26</span></span>
                            {yoyPct != null && <span className={up ? 'text-green-300' : 'text-red-300'}>{up ? '+' : ''}{yoyPct}% YoY</span>}
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${yoyW}%` }} />
                        </div>
                        {t.fy26SamePoint != null && <div className="text-[10px] text-gray-500 font-semibold mt-1.5">vs {t.fy26SamePoint} at the same point in FY26</div>}
                    </div>
                );
            })() : null}
        </div>
    );
};

/* ------------------------------------------------------ AI Gym Designer usage
 * "Gym designs created" is a GAF Critical Number (Adam Carter, Aug 2026).
 *
 * The count comes live from the designer app's own Cloudflare Pages function,
 * which owns the permanent `stat:design:` marker keys. Deliberately NOT a nightly
 * job on anyone's Mac, and deliberately not a count of live `design:` keys, which
 * carry a 90-day TTL and would make the number silently fall over time.
 *
 * The OPSP doc still owns the name, owner and bands. This only ever supplies the
 * Current value, so Adam never types this one in.
 */
const DESIGN_STATS_URL = 'https://gaf-gym-designer.pages.dev/api/stats';
const DESIGN_STATS_CACHE = 'gaf-design-stats-v1';
const GYM_DESIGN_CN = /gym\s*design/i;

interface DesignStats {
    total: number;
    last30: number;
    daily: { date: string; count: number }[];
    firstDesign: string | null;
    asOf: string;
}

const useDesignStats = () => {
    const [stats, setStats] = useState<DesignStats | null>(null);
    const [stale, setStale] = useState(false);

    useEffect(() => {
        let cancelled = false;
        // Paint the last good response first, then correct it. HGBTracker returns
        // null on failure and vanishes silently; a Critical Number should degrade
        // to a visibly dated number rather than disappear.
        try {
            const cached = localStorage.getItem(DESIGN_STATS_CACHE);
            if (cached) { setStats(JSON.parse(cached)); setStale(true); }
        } catch { /* private mode / quota — not worth failing over */ }

        fetch(DESIGN_STATS_URL)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d: DesignStats) => {
                if (cancelled || typeof d?.total !== 'number') return;
                setStats(d);
                setStale(false);
                try { localStorage.setItem(DESIGN_STATS_CACHE, JSON.stringify(d)); } catch { /* ignore */ }
            })
            .catch(() => { /* keep the cached figure, already flagged stale */ });

        return () => { cancelled = true; };
    }, []);

    return { stats, stale };
};

// Published-to-web copy of "GAF - One Page Plan (Scaling Up Scoreboard)".
// If this tab ever shows the fallback snapshot, the first thing to check is that the
// doc is still File > Share > Publish to web. An unpublished doc returns 401 to the
// proxy, which is indistinguishable from a proxy outage from the browser's side.
const DOC_PUB_URL =
    "https://docs.google.com/document/d/e/2PACX-1vRKUADNpV9pz1kwD44mxS2sdmTKqhQ8E64f9d8AnODzC1ekkZeL6OU9ND6OrofrYeQFuJfiOJMlSgzg/pub";

// One doc per quarter, Q1 FY27 through Q4 FY30 (GAF OPSP — <label>, same Drive folder
// as the old combined doc). Each is fully self-contained (Foundation, Targets, SWOT,
// Quarterly, Theme, Supporting) rather than sharing one doc that gets overwritten every
// quarter, so old quarters stay readable and the tab can page between them like Sales
// Health pages between months. `pubUrl` is null until that quarter's doc has actually
// been published (File > Share > Publish to web) — add the link here once it has.
interface QuarterConfig { label: string; period: string; pubUrl: string | null; }
const QUARTERS: QuarterConfig[] = (() => {
    const list: QuarterConfig[] = [];
    // [periodStart, periodEnd] per quarter within a fiscal year starting 1 July.
    const spans = [
        ['01/07', '30/09'], ['01/10', '31/12'], ['01/01', '31/03'], ['01/04', '30/06'],
    ];
    for (const fy of [27, 28, 29, 30]) {
        spans.forEach(([start, end], i) => {
            const startYear = i < 2 ? 2000 + fy - 1 : 2000 + fy;
            const endYear = startYear;
            list.push({
                label: `Q${i + 1} FY${fy}`,
                period: `${start}/${startYear} - ${end}/${endYear}`,
                pubUrl: null,
            });
        });
    }
    // Q1 FY27: the original combined doc's published copy, still showing this quarter's
    // data (Critical Numbers, Theme) until that doc is retired in favour of its own.
    list[0].pubUrl = DOC_PUB_URL;
    // Q2-Q4 FY27: published 4 Oct 2026, Foundation/Targets/SWOT self-contained,
    // Quarterly/Theme still "Not set" since those quarters haven't happened yet.
    list[1].pubUrl =
        "https://docs.google.com/document/d/e/2PACX-1vSq9eW6erS3nfAboV8QICXsYrbcYDL8pmFCgEDM2qStSF7h-P3RXzWaAlCR9zH8qGM_zww082DgmUO0/pub";
    list[2].pubUrl =
        "https://docs.google.com/document/d/e/2PACX-1vSA6wNek2VAD5eH5_39ze14Z7TUlBQNMUgrvvJ2rwzTQa9Y-iYUXGRDgPDizljcT5v08NM1xNrnshv5/pub";
    list[3].pubUrl =
        "https://docs.google.com/document/d/e/2PACX-1vSz_37w7mG3M9wLQIJzssVKrS0TX3_S8NXry3DoLppfFEbnYaFtcTdi7cOGEOj3QDWLz8Lh88c9HDm1/pub";
    // Q4 FY30: published 4 Oct 2026.
    list[15].pubUrl =
        "https://docs.google.com/document/d/e/2PACX-1vSRGKPn-hGejZQpQRrEsNxBAg3CbIciLH6FPE_FTWZ_tGl1GcaJwWxG4NWJ65R5_h9wlXWZ6RinSRcs/pub";
    return list;
})();

// yyyy from a "dd/mm/yyyy - dd/mm/yyyy" period: just enough to sort/compare quarters
// against "today" without pulling in a date library for 16 fixed spans.
const quarterStartDate = (q: QuarterConfig): Date => {
    const [startStr] = q.period.split(' - ');
    const [d, m, y] = startStr.split('/').map(Number);
    return new Date(y, m - 1, d);
};

const quarterEndDate = (q: QuarterConfig): Date => {
    const [, endStr] = q.period.split(' - ');
    const [d, m, y] = endStr.split('/').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59);
};

// The only two numbers on this tab that are NOT in the doc. The AOV baseline has no
// field in the Scaling Up template, so the target is derived from it and whatever the
// doc's Green band says (4% today) rather than being frozen at $1512. If Josh adds a
// baseline row to the doc, read it here and delete the constant.
const AOV_BASELINE = 1454;
const TARGET_CALLS = 40;

// Measurable Target / Critical #: "Reduce GC Dead Stock: $692k ➔ <$400k" (locked when
// the OPSP target was set). Not a row in the doc, so it's a separate card. Live-fetches
// the "Grand Total" cell from the GAF_DEADSTOCK sheet (published to web as CSV), same as
// the AOV/inbound-call feeds above — no committed snapshot, always reflects the sheet.
// It was Q1 FY27's one-off Theme target, not a recurring Foundation number, so it's only
// rendered when quarterIndex === 0 (see the render call below).
const GC_DEAD_STOCK_TARGET = 400000;
const GC_DEAD_STOCK_BASELINE = 692000;

const GCDeadStockCard: React.FC = () => {
    const [current, setCurrent] = useState<number | null>(null);
    useEffect(() => {
        fetchGCDeadStockTotal().then((v) => v != null && setCurrent(v));
    }, []);
    if (current == null) return null;
    const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;
    const tone: 'super' | 'yellow' | 'red' =
        current < GC_DEAD_STOCK_TARGET ? 'super' : current < GC_DEAD_STOCK_BASELINE ? 'yellow' : 'red';
    const label = tone === 'super' ? 'Target Hit' : tone === 'yellow' ? 'Improving' : 'Red';
    const asOf = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
            <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                    <div className="font-bold text-lg leading-tight">Reduce GC Dead Stock</div>
                    <div className="text-xs text-gray-400 mt-1">AFS-Gold Coast only</div>
                </div>
                <div className={`px-2 py-1 text-xs font-bold rounded border shrink-0 ${TONE[tone]}`}>{label}</div>
            </div>
            <div className="border-t border-white/10 pt-4">
                <div className="text-[10px] uppercase text-gray-400 font-bold mb-1">Current</div>
                <div className="text-3xl font-black mb-4">{fmtK(current)}</div>
                <div className="grid grid-cols-2 gap-1.5 text-center">
                    <div className="bg-white/5 rounded-lg py-2">
                        <div className="text-[9px] uppercase text-gray-500 font-bold">Start</div>
                        <div className="text-xs font-bold text-gray-200">{fmtK(GC_DEAD_STOCK_BASELINE)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg py-2">
                        <div className="text-[9px] uppercase text-gray-500 font-bold">Target</div>
                        <div className="text-xs font-bold text-gray-200">&lt;{fmtK(GC_DEAD_STOCK_TARGET)}</div>
                    </div>
                </div>
                <div className="text-[10px] text-gray-500 font-semibold mt-3">As of {asOf}</div>
            </div>
        </div>
    );
};

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
        // Normalise the label: lowercase, collapse whitespace, strip trailing noise like
        // "$", ":" or "." so a doc row relabelled "GROSS PROFIT $" still matches. "%" is
        // preserved so the margin row stays distinct from the dollar row.
        const cat = cells[0].toLowerCase().replace(/\s+/g, ' ').trim().replace(/[\s$*:.]+$/g, '').trim();
        if (cat === 'revenue') out.fy27Revenue = cells[1];
        else if (cat === 'gross profit') out.fy27GrossProfit = cells[1];
        else if (cat === 'gross profit %') out.fy27GPMargin = cells[1];
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

/* ------------------------------------------------------------ doc fetching */

// Google serves published docs cross-origin, so they have to be proxied. allorigins is
// flaky (rate-limits, hangs), which would otherwise leave the tab stuck on the loader,
// so race a timeout and fall through to the next proxy before giving up.
const DOC_PROXIES = (url: string) => [
    `https://afs-docs-proxy.josh-03c.workers.dev/?url=${encodeURIComponent(url)}`,
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

const fetchPublishedDoc = async (pubUrl: string): Promise<string | null> => {
    const url = `${pubUrl}${pubUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    for (const p of DOC_PROXIES(url)) {
        try {
            const html = await viaProxy(p);
            if (html) return html;
        } catch (e) {
            console.warn("OPSP proxy failed, trying next.", e);
        }
    }
    return null;
};

/* ------------------------------------------------- persistent critical numbers
 * "GAF OPSP — Foundation (Persistent Critical Numbers)" holds the rows that show on
 * EVERY quarter (IDC GP% and Gym Designs Created). Before this, nothing ever read that
 * doc, so IDC GP% silently disappeared once the per-quarter docs took over.
 *
 * Resolution order per persistent number:
 *   1. the Foundation doc's row (name, owner, bands) when the doc loads;
 *   2. otherwise the built-in default below, so the card can never vanish again;
 *   3. Current is always supplied live by the app (designer API / GP sheet).
 * A same-metric row typed into a quarter doc is ignored to avoid duplicate cards.
 */
const FOUNDATION_PUB_URL =
    "https://docs.google.com/document/d/e/2PACX-1vSrd-JLWzP3ukDWWoRidhyIDCGERJ_5ehG_8geKOe9t0Wp60Hq2yU9_iJzZFrZjqP3SgRJNjkIfFG0X/pub";

const IDC_GP_CN = /IDC\s*GP/i;
const FILL_RATE_CN = /fill\s*rate/i;

const PERSISTENT_CNS: { match: RegExp; fallback: CriticalNumber }[] = [
    {
        match: IDC_GP_CN,
        fallback: {
            name: 'Increase GAF IDC GP% to >42%', owner: 'Adam Carter',
            superGreen: '>42%', green: '42%', yellow: '40%', red: '<40%', current: '',
        },
    },
    {
        match: GYM_DESIGN_CN,
        fallback: {
            name: 'Increase Gym Designs Created', owner: 'Adam Carter',
            superGreen: '250', green: '200', yellow: '150', red: '120', current: '',
        },
    },
];

const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtShortDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

/* ------------------------------------------------------------------ component */

// Default to the latest quarter that's both published and already started, so the tab
// never opens on a future quarter nobody has filled in yet (same idea as Sales Health
// defaulting to the current month, not a later one with no data).
const defaultQuarterIndex = (): number => {
    const now = new Date();
    for (let i = QUARTERS.length - 1; i >= 0; i--) {
        if (QUARTERS[i].pubUrl && quarterStartDate(QUARTERS[i]) <= now) return i;
    }
    return 0;
};

export default function OPSPDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<OpspData | null>(null);
    const [isLive, setIsLive] = useState(true);
    const [notPublished, setNotPublished] = useState(false);
    const [bhagData, setBhagData] = useState<BHAGData | null>(null);
    const [quarterIndex, setQuarterIndex] = useState(defaultQuarterIndex);
    // null = not loaded yet / unavailable → built-in defaults are used.
    const [foundationCNs, setFoundationCNs] = useState<CriticalNumber[] | null>(null);
    const [fillRate, setFillRate] = useState<FillRateData | null>(null);
    const [idcGp, setIdcGp] = useState<IdcGpQuarter | null>(null);

    const quarter = QUARTERS[quarterIndex];
    const changeQuarter = (offset: number) =>
        setQuarterIndex((i) => Math.max(0, Math.min(QUARTERS.length - 1, i + offset)));

    // Fire-and-forget: the AOV and inbound-call charts read their own CSV feeds, must
    // never block or fail the OPSP text render, and don't change when the quarter does.
    useEffect(() => {
        let cancelled = false;
        fetchBHAGData()
            .then((res) => { if (!cancelled) setBhagData(res); })
            .catch((e) => console.warn("BHAG fetch failed", e));
        return () => { cancelled = true; };
    }, []);

    // Persistent Critical Numbers (Foundation doc) and the Fill Rate report don't change
    // with the quarter selector, so they load once. Both degrade quietly: Foundation to
    // the built-in defaults, Fill Rate to whatever Current is typed in the quarter doc.
    useEffect(() => {
        let cancelled = false;
        fetchPublishedDoc(FOUNDATION_PUB_URL).then((html) => {
            if (cancelled || !html) return;
            try {
                const rows = parseDoc(html).criticalNumbers;
                if (rows.length) setFoundationCNs(rows);
            } catch (e) {
                console.warn("Foundation doc parse failed; using built-in persistent numbers.", e);
            }
        });
        fetchFillRate().then((d) => { if (!cancelled && d) setFillRate(d); });
        return () => { cancelled = true; };
    }, []);

    // IDC GP% is the SELECTED quarter's average, so it refetches when the quarter changes.
    useEffect(() => {
        let cancelled = false;
        setIdcGp(null);
        const q = QUARTERS[quarterIndex];
        fetchIdcGpQuarter(quarterStartDate(q), quarterEndDate(q))
            .then((d) => { if (!cancelled) setIdcGp(d); });
        return () => { cancelled = true; };
    }, [quarterIndex]);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setIsLive(true);
        setNotPublished(false);

        if (!quarter.pubUrl) {
            // Doc for this quarter hasn't been created/published yet — nothing to fetch.
            setData(null);
            setNotPublished(true);
            setIsLoading(false);
            return;
        }

        (async () => {
            const html = await fetchPublishedDoc(quarter.pubUrl!);
            if (cancelled) return;
            if (!html) {
                console.warn("All OPSP proxies failed; rendering fallback snapshot.");
                setData(quarterIndex === 0 ? FALLBACK : null);
                setIsLive(false);
                return;
            }
            try {
                setData(parseDoc(html));
            } catch (e) {
                console.warn("OPSP parse failed; rendering fallback snapshot.", e);
                setData(quarterIndex === 0 ? FALLBACK : null);
                setIsLive(false);
            }
        })().finally(() => { if (!cancelled) setIsLoading(false); });

        return () => { cancelled = true; };
    }, [quarterIndex]);

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

    const { stats: designStats, stale: designStatsStale } = useDesignStats();

    // Persistent rows (Foundation doc, else built-in) first, then this quarter's own doc
    // rows, then the app's live Current values merged over the top. The docs own name,
    // owner and bands; the app owns Current wherever a live feed exists.
    type CNRow = CriticalNumber & { note?: string; source?: string };
    const criticalNumbers = useMemo<CNRow[]>(() => {
        const persistent: CNRow[] = PERSISTENT_CNS.map(({ match, fallback }) => {
            const fromDoc = (foundationCNs || []).find((c) => match.test(c.name));
            return { ...(fromDoc || fallback) };
        });
        const quarterRows: CNRow[] = (data?.criticalNumbers || [])
            .filter((c) => !PERSISTENT_CNS.some(({ match }) => match.test(c.name)))
            .map((c) => ({ ...c }));
        const rows = [...persistent, ...quarterRows];

        const designs = rows.find((c) => GYM_DESIGN_CN.test(c.name));
        if (designs && designStats) {
            designs.current = designStats.total.toLocaleString();
            designs.source = 'Live from the designer app' + (designStatsStale
                ? ' • app unreachable, showing last known figure'
                : ` • as at ${new Date(designStats.asOf).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`);
        }

        const idc = rows.find((c) => IDC_GP_CN.test(c.name));
        if (idc) {
            idc.current = idcGp?.average != null ? fmtPct(idcGp.average) : '';
            if (idcGp?.average != null && idcGp.lastDate) {
                idc.source = `Live • ${quarter.label} avg of ${idcGp.days} days' fulfilled GM% to ${fmtShortDate(idcGp.lastDate)}`;
            } else if (idcGp) {
                idc.source = `No fulfilled sales recorded for ${quarter.label} yet`;
            }
        }

        // Fill Rate is a quarterly number, so it only shows where a quarter doc lists it.
        // Its Current AND bands come from the report (bands = row 1 above SUPERGREEN/
        // GREEN/ORANGE/RED); the values typed in the doc are only a fallback.
        const fr = rows.find((c) => FILL_RATE_CN.test(c.name));
        const latest = fillRate?.weeks[fillRate.weeks.length - 1];
        if (fr && fillRate && latest) {
            const t = fillRate.bandThresholds;
            if (t.superGreen != null) fr.superGreen = `${t.superGreen}%`;
            if (t.green != null) fr.green = `${t.green}%`;
            if (t.yellow != null) fr.yellow = `${t.yellow}%`;
            if (t.red != null) fr.red = `${t.red}%`;
            fr.current = fmtPct(latest.total);
            const prev = fillRate.weeks[fillRate.weeks.length - 2];
            const wow = prev ? latest.total - prev.total : null;
            fr.source = `Live • Wk ${latest.week} (w/e ${fmtShortDate(latest.weekEnding)})`
                + (wow != null ? ` • ${wow >= 0 ? '▲' : '▼'}${Math.abs(wow).toFixed(1)} pts WoW` : '')
                + (fillRate.target != null ? ` • target ${fillRate.target}%` : '');
        } else if (fr) {
            fr.source = 'Fill Rate report not reachable, showing the value typed in the OPSP doc';
        }

        for (const r of rows) if (!num(r.green) && !r.note) r.note = 'Bands not set in the OPSP doc.';
        return rows;
    }, [data, foundationCNs, designStats, designStatsStale, idcGp, fillRate, quarter.label]);

    const showFillRate = criticalNumbers.some((c) => FILL_RATE_CN.test(c.name));
    const fillRateChart = useMemo(() => (fillRate?.weeks || []).map((w) => ({
        label: `Wk ${w.week}`,
        sub: fmtShortDate(w.weekEnding),
        total: w.total,
    })), [fillRate]);
    const fillRateLatest = fillRate?.weeks[fillRate.weeks.length - 1] || null;

    // Last 30 calendar days, zero-filled, so a quiet stretch reads as a gap rather
    // than collapsing the axis into a handful of busy days.
    const designDailyData = useMemo(() => {
        if (!designStats) return [];
        const counts = new Map(designStats.daily.map((x) => [x.date, x.count]));
        const out: { date: string; label: string; designs: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const dt = new Date();
            dt.setDate(dt.getDate() - i);
            const key = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
            }).format(dt);
            out.push({
                date: key,
                label: dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
                designs: counts.get(key) ?? 0,
            });
        }
        return out;
    }, [designStats]);

    const quarterNav = (
        <div className="flex items-center gap-1 text-xs md:text-sm text-gray-600 bg-gray-100 rounded-lg px-1.5 py-1 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-gray-400 ml-0.5" />
            <button
                onClick={() => changeQuarter(-1)}
                disabled={quarterIndex === 0}
                className="p-0.5 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous quarter"
            >
                <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
            <span className="min-w-[72px] text-center font-bold text-gray-800">{quarter.label}</span>
            <button
                onClick={() => changeQuarter(1)}
                disabled={quarterIndex === QUARTERS.length - 1}
                className="p-0.5 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next quarter"
            >
                <ChevronRight className="w-3.5 h-3.5" />
            </button>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
                <p className="text-gray-500 font-medium">Fetching Live OPSP Data...</p>
            </div>
        );
    }

    if (notPublished || !data) {
        return (
            <div className="min-h-screen bg-[#f8f8fa] font-sans">
                <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
                    <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-700 shrink-0">
                                <Compass size={24} />
                            </div>
                            <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900 truncate">
                                One Page Strategic Plan
                            </h1>
                        </div>
                        {quarterNav}
                    </div>
                </header>
                <div className="flex flex-col items-center justify-center text-center gap-3 py-32 px-4">
                    <FileX className="w-10 h-10 text-gray-300" />
                    {notPublished ? (
                        <>
                            <p className="text-gray-700 font-bold">{quarter.label} hasn't been published yet</p>
                            <p className="text-sm text-gray-400 max-w-sm">
                                {quarter.period} — create and publish the "GAF OPSP — {quarter.label}" doc (File &gt; Share &gt; Publish to web) to see it here.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-gray-700 font-bold">Couldn't load {quarter.label} right now</p>
                            <p className="text-sm text-gray-400 max-w-sm">
                                The published doc exists but didn't load — this is usually a temporary proxy or network issue. Try again shortly.
                            </p>
                        </>
                    )}
                </div>
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
                            <SourceNote
                                text={`Source: GAF OPSP — ${quarter.label} doc · refreshed when this page loaded${isLive ? '' : ' (showing cached snapshot, see below)'}`}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {quarterNav}
                        {!isLive && (
                            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg">
                                <AlertTriangle size={12} /> Showing cached snapshot
                            </span>
                        )}
                        <a
                            href={quarter.pubUrl ?? DOC_PUB_URL}
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
                            <div id="hgb-tracker" className={d.bhagTargets.length ? 'mt-4 scroll-mt-24' : 'scroll-mt-24'}><HGBTracker /></div>
                        </div>
                    </div>
                </div>

                {/* QUARTERLY CRITICAL NUMBERS + THEME */}
                <div className="bg-gray-900 rounded-2xl shadow-md p-6 md:p-8 text-white relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-gray-500" />

                    <div className="flex items-center gap-2 mb-8">
                        <div className="p-2 bg-white/10 text-white rounded-lg"><Rocket size={20} /></div>
                        <h3 className="font-bold text-xl">Critical Numbers • {d.quarterLabel.replace(/^Quarterly\s*/i, '').replace(/[()]/g, '')}</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* A fixed 2-col grid leaves a dead half-width hole when there's only
                            one card total, so only split above one. GC Dead Stock isn't a doc
                            row (see GCDeadStockCard above) and was only ever Q1 FY27's one-off
                            Theme target, so it's shown only on quarterIndex 0 and counts toward
                            the total here. `criticalNumbers` is the doc's rows with the live
                            designs-created count merged in, so it may run one longer than the
                            doc itself. */}
                        <div className={`lg:col-span-2 grid gap-4 grid-cols-1 ${criticalNumbers.length + (quarterIndex === 0 ? 1 : 0) > 1 ? 'md:grid-cols-2' : ''}`}>
                            {quarterIndex === 0 && <GCDeadStockCard />}
                            {criticalNumbers.map((cn, i) => {
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
                                            {cn.note && (
                                                <div className="flex items-start gap-1.5 mt-3 text-[11px] text-amber-300/90 font-medium">
                                                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                    <span>{cn.note}</span>
                                                </div>
                                            )}
                                            {cn.source && (
                                                <div className="text-[10px] text-gray-500 font-semibold mt-2">{cn.source}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex flex-col">
                            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-4">Theme (Qtr / Annual)</div>
                            {d.theme.length === 0 && <p className="text-sm text-gray-400 italic">Not entered.</p>}
                            {/* justify-between spreads the items across the full stretched height of
                                this column (it sits beside the 2x2 critical-number grid, which is
                                usually taller), rather than clumping them at the top with dead space
                                below — each gets its own sub-card so the column reads as filled. */}
                            <div className="flex-1 flex flex-col justify-between gap-4">
                                {d.theme.map((t, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-center bg-white/5 rounded-xl p-6 border border-white/10">
                                        <div className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">{t.key}</div>
                                        <div className={`leading-snug ${t.key.toLowerCase() === 'theme'
                                            ? 'text-2xl font-black text-orange-300 font-montserrat'
                                            : 'text-lg text-gray-200 font-medium'}`}>
                                            {t.value && !PLACEHOLDER.test(t.value)
                                                ? t.value
                                                : <span className="text-gray-500 italic font-normal text-sm">Not set</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* TREND DETAIL — the critical numbers that have a live feed
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
                                    <SourceNote text="Source: BHAG AOV feed (published Google Sheet) · refreshed when this page loaded" className="ml-9 mt-0.5" />
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
                                    <SourceNote text="Source: BHAG inbound-calls feed (published Google Sheet) · refreshed when this page loaded" className="ml-9 mt-0.5" />
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

                        {/* Inventory Fill Rate — Q2 FY27 Critical Number and Theme target
                            ("Locked - Stocked - Loaded"). Weekly, from the Netstock-fed Fill
                            Rate Report; the target line is the report's own "On Target" cell. */}
                        {showFillRate && fillRate && fillRateLatest && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                                <div className="flex justify-between items-start gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><Package size={16} /></div>
                                            <h3 className="font-bold text-gray-900">Inventory Fill Rate</h3>
                                            <a
                                                href="https://docs.google.com/spreadsheets/d/1OpKiBIhb7nAnGjHeKj_0Uiij1mb1kuTvgX8Jh6BeLDw/edit?gid=1409487408#gid=1409487408"
                                                target="_blank" rel="noopener noreferrer"
                                                className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                                                title="View source spreadsheet"
                                            ><Info size={16} /></a>
                                        </div>
                                        <p className="text-xs text-gray-500 ml-9">
                                            Weekly, FY to date
                                            {fillRate.target != null && (<> <span className="mx-1">•</span> Target <span className="font-bold text-green-600">{fillRate.target}%</span></>)}
                                        </p>
                                        <SourceNote text="Source: Fill Rate Report - FY27 (Netstock, updated weekly) · refreshed when this page loaded" className="ml-9 mt-0.5" />
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-2xl font-bold text-gray-900">{fmtPct(fillRateLatest.total)}</div>
                                        <div className="text-xs text-gray-500 font-medium mb-1">Wk {fillRateLatest.week} · w/e {fmtShortDate(fillRateLatest.weekEnding)}</div>
                                        {fillRate.target != null && (
                                            <div className={`text-xs font-bold ${fillRateLatest.total >= fillRate.target ? 'text-green-600' : 'text-red-500'}`}>
                                                {fillRateLatest.total >= fillRate.target
                                                    ? 'On target'
                                                    : `${(fillRate.target - fillRateLatest.total).toFixed(1)} pts below target`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-1 min-h-[240px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsBarChart data={fillRateChart} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                                            <YAxis tickFormatter={(v) => `${v}%`} domain={[60, 100]} allowDataOverflow tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                                            <Tooltip
                                                formatter={(val: number) => [fmtPct(val), 'Fill rate']}
                                                labelFormatter={(lbl: string, p: any[]) => (p?.[0]?.payload?.sub ? `${lbl} · w/e ${p[0].payload.sub}` : lbl)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                            />
                                            {fillRate.target != null && (
                                                <ReferenceLine y={fillRate.target} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                                                    <Label value={`Target ${fillRate.target}%`} position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                                                </ReferenceLine>
                                            )}
                                            <Bar dataKey="total" fill={GAF_COLORS.orange} radius={[4, 4, 0, 0]} barSize={20} />
                                        </RechartsBarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Latest week split two ways: product category, and the SKU
                                    performance band (each band has its own fill target). */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">By category · Wk {fillRateLatest.week}</div>
                                        <div className="space-y-1">
                                            {fillRate.categoryNames.filter((n) => fillRateLatest.categories[n] != null).map((n) => (
                                                <div key={n} className="flex justify-between text-xs">
                                                    <span className="text-gray-600 font-medium capitalize">{n.toLowerCase()}</span>
                                                    <span className={`font-bold ${fillRate.target != null && fillRateLatest.categories[n] < fillRate.target ? 'text-red-500' : 'text-gray-900'}`}>{fmtPct(fillRateLatest.categories[n])}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">By SKU band · vs band target</div>
                                        <div className="space-y-1">
                                            {fillRate.bandNames.filter((n) => fillRateLatest.bands[n] != null).map((n) => {
                                                const key = n.replace(/\s+/g, '').toUpperCase();
                                                const t = key === 'SUPERGREEN' ? fillRate.bandThresholds.superGreen
                                                    : key === 'GREEN' ? fillRate.bandThresholds.green
                                                    : key === 'RED' ? fillRate.bandThresholds.red
                                                    : fillRate.bandThresholds.yellow;
                                                const v = fillRateLatest.bands[n];
                                                return (
                                                    <div key={n} className="flex justify-between text-xs">
                                                        <span className="text-gray-600 font-medium capitalize">{n.toLowerCase()}</span>
                                                        <span>
                                                            <span className={`font-bold ${t != null && v < t ? 'text-red-500' : 'text-green-600'}`}>{fmtPct(v)}</span>
                                                            {t != null && <span className="text-gray-400 font-semibold"> / {t}%</span>}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Gym designs created — the third critical number with a live feed.
                            Unlike AOV and calls, this one comes straight from the app that
                            creates the designs, not from a spreadsheet. */}
                        {designStats && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
                                <div className="flex justify-between items-start gap-4 mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="p-1.5 bg-orange-100 text-orange-700 rounded-lg"><PencilRuler size={16} /></div>
                                            <h3 className="font-bold text-gray-900">Gym Designs Created</h3>
                                            <a
                                                href="https://gaf-gym-designer.pages.dev"
                                                target="_blank" rel="noopener noreferrer"
                                                className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                                                title="Open the Home Gym Designer"
                                            ><Info size={16} /></a>
                                        </div>
                                        <p className="text-xs text-gray-500 ml-9">
                                            Last 30 days
                                            {designStats.firstDesign && (
                                                <> <span className="mx-1">•</span> since {new Date(designStats.firstDesign).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-2xl font-bold text-gray-900">{designStats.total.toLocaleString()}</div>
                                        <div className="text-xs font-bold text-gray-500">{designStats.last30.toLocaleString()} in 30d</div>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsBarChart data={designDailyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} interval={4} />
                                            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} allowDecimals={false} />
                                            <Tooltip
                                                formatter={(val: number) => [val, 'Designs created']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="designs" fill={GAF_COLORS.orange} radius={[4, 4, 0, 0]} barSize={14} />
                                        </RechartsBarChart>
                                    </ResponsiveContainer>
                                </div>
                                <p className="text-[10px] text-gray-400 font-semibold mt-3">
                                    Includes the 20-22 Jul internal test round. Counted in Adelaide time.
                                </p>
                                <SourceNote
                                    text={`Source: AI Gym Designer API${designStats.asOf ? ` · as of ${new Date(designStats.asOf).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}`}
                                    className="mt-1"
                                />
                            </div>
                        )}
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
