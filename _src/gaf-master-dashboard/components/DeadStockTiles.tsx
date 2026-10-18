import React, { useEffect, useState } from 'react';
import { Info, PackageX, Warehouse } from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Area, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ReferenceArea, Label,
} from 'recharts';
import { GAF_COLORS } from '../constants';
import { SourceNote } from './SourceNote';

/* Dead stock trend tiles (OPSP Trend Detail, Q2 FY27 onward).
 *
 * Q1 FY27 tracked "Reduce GC Dead Stock" as a Critical Number; that result is frozen
 * in data/opsp-finals.json and is NOT read or changed here. These tiles keep tracking
 * dead stock as a trend after it stopped being critical:
 *
 *   1. GAF dead stock vs sales — AFS-Gold Coast dead stock as a % of GAF annual budgeted
 *      sales (the FY revenue figure in the OPSP doc, passed in as `annualSales`).
 *      Goal: under 1%.
 *   2. Gold Coast sub-location dead stock — five GC sub-locations chosen by Adam (Oct 2026).
 *      Goal $0 at Quarantine, Showroom Missing, Ex-Demo and Arundel Showroom. Spare Parts
 *      is tracked with no goal: stock is expected to sit there for a while after an item
 *      is classified as dead stock.
 *
 * Data: deadstock-tracker.json, written daily by the "Dead stock tracker" GitHub Action
 * (_pipelines/deadstock-tracker/update.py) from the Deadstock Tracker - FY27 sheet's
 * LOCATION SUMMARY tab. Each month column is that month's closing value; the latest
 * column is the current value, refreshed every run.
 */

const URL_SHEET = 'https://docs.google.com/spreadsheets/d/1Bd4W9eyhlVn7eBE3dAQYdVr5-acjhT2vNhfPHXJWXs0/edit?gid=1532643813#gid=1532643813';
const GAF_GOAL_PCT = 1;
const Q1_FROZEN = { from: '2026-07', to: '2026-09', final: 404482 };

interface DSLocation { key: string; name: string; goal: number | null; values: (number | null)[] }
export interface DeadStockData {
    asOf: string;
    months: string[];           // "YYYY-MM"
    gc: (number | null)[];      // AFS-Gold Coast (parent location) total per month
    locations: DSLocation[];
    daily?: { date: string; gc: number; locations: Record<string, number> }[];
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monLabel = (ym: string) => MON[Number(ym.slice(5, 7)) - 1];
const k = (n: number) => `$${Math.round(n / 1000).toLocaleString()}k`;
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtAsOf = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const tooltipStyle = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };

// Fixed categorical order so a location keeps its colour if the list changes.
const LOC_COLORS: Record<string, string> = {
    quarantine: '#2a78d6',
    showroomMissing: '#eda100',
    exDemo: '#6250d6',
    arundel: '#e87ba4',
    spareParts: '#6b7280',
};

export const useDeadStockData = () => {
    const [d, setD] = useState<DeadStockData | null>(null);
    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}deadstock-tracker.json?cb=${Date.now()}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => j && setD(j))
            .catch(() => {});
    }, []);
    return d;
};

/* ------------------------------------------------------------ 1. GAF vs sales */

export const GafDeadStockTile: React.FC<{ data: DeadStockData; annualSales: number | null }> = ({ data, annualSales }) => {
    if (!annualSales || annualSales <= 0) return null;
    const last = data.months.length - 1;
    const rows = data.months.map((m, i) => {
        const v = data.gc[i];
        return {
            ym: m,
            label: i === last ? `${monLabel(m)} · now` : monLabel(m),
            value: v,
            pct: v != null ? +((v / annualSales) * 100).toFixed(2) : null,
        };
    });
    const cur = data.gc[last];
    if (cur == null) return null;
    const curPct = (cur / annualSales) * 100;
    const goalValue = annualSales * (GAF_GOAL_PCT / 100);
    const atGoal = curPct < GAF_GOAL_PCT;
    const q1From = rows.find((r) => r.ym === Q1_FROZEN.from)?.label;
    const q1To = rows.find((r) => r.ym === Q1_FROZEN.to)?.label;
    const yMax = Math.max(3, Math.ceil(Math.max(...rows.map((r) => r.pct ?? 0)) + 0.5));

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg"><PackageX size={16} /></div>
                        <h3 className="font-bold text-gray-900">GAF Dead Stock vs Sales</h3>
                        <a href={URL_SHEET} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors ml-1" title="View source spreadsheet"><Info size={16} /></a>
                    </div>
                    <p className="text-xs text-gray-500 ml-9">
                        AFS-Gold Coast <span className="mx-1">•</span>
                        Goal <span className="font-bold text-green-600">&lt;{GAF_GOAL_PCT}%</span> of GAF FY budgeted sales ({k(goalValue)})
                    </p>
                    <SourceNote text={`Source: Deadstock Tracker - FY27 · $${(annualSales / 1e6).toFixed(2)}M sales budget from the OPSP doc · as of ${fmtAsOf(data.asOf)}`} className="ml-9 mt-0.5" />
                </div>
                <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-900">{curPct.toFixed(2)}%</div>
                    <div className="text-xs text-gray-500 font-medium mb-1">{k(cur)} today</div>
                    <div className={`text-xs font-bold ${atGoal ? 'text-green-600' : 'text-red-500'}`}>
                        {atGoal ? 'At goal' : `${k(cur - goalValue)} above goal`}
                    </div>
                </div>
            </div>
            <div className="flex-1 min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        {q1From && q1To && (
                            <ReferenceArea x1={q1From} x2={q1To} fill="#9ca3af" fillOpacity={0.12} strokeOpacity={0}>
                                <Label value={`Q1 FY27 · frozen (final ${k(Q1_FROZEN.final)})`} position="insideTop" fill="#6b7280" fontSize={10} />
                            </ReferenceArea>
                        )}
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                        <YAxis tickFormatter={(v) => `${v}%`} domain={[0, yMax]} tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(val: number, _n: string, p: any) => [`${val.toFixed(2)}%  (${money(p.payload.value)})`, 'Dead stock / sales']}
                            contentStyle={tooltipStyle}
                        />
                        <ReferenceLine y={GAF_GOAL_PCT} stroke={GAF_COLORS.green} strokeDasharray="3 3">
                            <Label value={`Goal ${GAF_GOAL_PCT}%`} position="insideTopRight" fill={GAF_COLORS.green} fontSize={10} />
                        </ReferenceLine>
                        <Area dataKey="pct" type="monotone" stroke={GAF_COLORS.orange} strokeWidth={2} fill={GAF_COLORS.orange} fillOpacity={0.1}
                            dot={{ r: 4, fill: GAF_COLORS.orange, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
                Monthly closing values; the last point is today's figure, refreshed daily. The Q1 Critical Number result is locked separately and doesn't move with this chart.
            </p>
        </div>
    );
};

/* -------------------------------------------- 2. Gold Coast sub-location stock */

export const GcSubLocationDeadStockTile: React.FC<{ data: DeadStockData }> = ({ data }) => {
    const last = data.months.length - 1;
    const goalLocs = data.locations.filter((l) => l.goal != null);
    const watchLocs = data.locations.filter((l) => l.goal == null);
    if (!goalLocs.length) return null;

    const rows = data.months.map((m, i) => {
        const r: Record<string, any> = { label: i === last ? `${monLabel(m)} · now` : monLabel(m) };
        data.locations.forEach((l) => { r[l.key] = l.values[i]; });
        return r;
    });
    const sumAt = (locs: DSLocation[], i: number) => locs.reduce((s, l) => s + (l.values[i] ?? 0), 0);
    const cur = sumAt(goalLocs, last);
    const prev = last > 0 ? sumAt(goalLocs, last - 1) : null;
    const delta = prev != null ? cur - prev : null;
    const prevMon = last > 0 ? monLabel(data.months[last - 1]) : '';
    const change = (a: number | null, b: number | null) => {
        if (a == null || b == null) return { txt: '—', cls: 'text-gray-400' };
        if (a === 0) return b > 0 ? { txt: 'new', cls: 'text-red-500' } : { txt: '—', cls: 'text-gray-400' };
        const p = Math.round(((b - a) / a) * 100);
        return { txt: `${p > 0 ? '+' : ''}${p}%`, cls: b > a ? 'text-red-500' : b < a ? 'text-green-600' : 'text-gray-400' };
    };
    const names = Object.fromEntries(data.locations.map((l) => [l.key, l.name]));

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col">
            <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-gray-100 text-gray-700 rounded-lg"><Warehouse size={16} /></div>
                        <h3 className="font-bold text-gray-900">Gold Coast Sub-location Dead Stock</h3>
                        <a href={URL_SHEET} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500 transition-colors ml-1" title="View source spreadsheet"><Info size={16} /></a>
                    </div>
                    <p className="text-xs text-gray-500 ml-9">
                        Goal <span className="font-bold text-green-600">$0</span> at {goalLocs.length} locations
                        {watchLocs.length > 0 && <> <span className="mx-1">•</span> {watchLocs.map((l) => l.name).join(', ')} tracked, no goal</>}
                    </p>
                    <SourceNote text={`Source: Deadstock Tracker - FY27, Location Summary · as of ${fmtAsOf(data.asOf)}`} className="ml-9 mt-0.5" />
                </div>
                <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-gray-900">{k(cur)}</div>
                    <div className="text-xs text-gray-500 font-medium mb-1">left to clear</div>
                    {delta != null && (
                        <div className={`text-xs font-bold ${cur === 0 ? 'text-green-600' : delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {cur === 0 ? 'At goal' : `${delta > 0 ? '+' : delta < 0 ? '-' : ''}${k(Math.abs(delta))} vs ${prevMon}`}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} dy={10} />
                        <YAxis tickFormatter={(v) => k(v)} tick={{ fontSize: 11 }} stroke="#9ca3af" axisLine={false} tickLine={false} />
                        <Tooltip
                            formatter={(val: number, key: string) => [money(val), `${names[key] ?? key}${watchLocs.some((l) => l.key === key) ? ' (no goal)' : ''}`]}
                            contentStyle={tooltipStyle}
                        />
                        {goalLocs.map((l, i) => (
                            <Bar key={l.key} dataKey={l.key} stackId="goal" fill={LOC_COLORS[l.key] ?? GAF_COLORS.mediumGrey}
                                stroke="#fff" strokeWidth={1} barSize={28} radius={i === goalLocs.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} isAnimationActive={false} />
                        ))}
                        {watchLocs.map((l) => (
                            <Line key={l.key} dataKey={l.key} type="monotone" stroke={LOC_COLORS[l.key] ?? '#6b7280'} strokeWidth={2} strokeDasharray="5 4"
                                dot={{ r: 3, fill: LOC_COLORS[l.key] ?? '#6b7280', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="grid grid-cols-[12px_1fr_56px_80px_52px] gap-2 text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">
                    <span /><span>Location</span><span className="text-right">Goal</span><span className="text-right">Today</span><span className="text-right">vs {prevMon}</span>
                </div>
                {[...goalLocs, ...watchLocs].map((l) => {
                    const c = change(last > 0 ? l.values[last - 1] : null, l.values[last]);
                    const color = LOC_COLORS[l.key] ?? '#6b7280';
                    return (
                        <div key={l.key} className="grid grid-cols-[12px_1fr_56px_80px_52px] gap-2 items-center text-xs py-1 border-t border-gray-50">
                            {l.goal == null
                                ? <span className="h-0 border-t-2 border-dashed" style={{ borderColor: color }} />
                                : <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />}
                            <span className="text-gray-600 font-medium">{l.name}</span>
                            <span className="text-right text-gray-400 font-semibold">{l.goal == null ? 'none' : money(l.goal)}</span>
                            <span className="text-right font-bold text-gray-900 tabular-nums">{l.values[last] != null ? money(l.values[last] as number) : '—'}</span>
                            <span className={`text-right font-bold ${c.cls}`}>{c.txt}</span>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
                Bars = locations with a $0 goal (stacked); dashed line = Spare Parts, where stock is expected to sit for a while after it's classified as dead stock.
            </p>
        </div>
    );
};
