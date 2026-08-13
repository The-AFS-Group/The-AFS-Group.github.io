import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { AlertTriangle, ArrowRight, Boxes, Download, Ship, Snowflake } from 'lucide-react';
import type { Sku, StockStatus } from '../types';
import { GAF, SERIES, STATUS_ORDER, STATUS_STYLE } from '../constants';
import {
  Card,
  ChartTooltip,
  Empty,
  SectionTitle,
  StatusBadge,
} from './ui';
import {
  downloadCsv,
  fmtCompact,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  inboundByMonth,
  rollup,
  statusCounts,
  sum,
  weeklyRev,
} from '../utils/metrics';

const MONT = { fontFamily: "'Montserrat', sans-serif" };
const axis = { fontSize: 11, fill: GAF.grey500, fontFamily: "'Open Sans', sans-serif" };

/* ------------------------------------------------------------------ *
 * Stock health mix
 * ------------------------------------------------------------------ */

export const StockHealthMix: React.FC<{ rows: Sku[]; onPick?: (s: StockStatus) => void }> = ({
  rows,
  onPick,
}) => {
  const data = statusCounts(rows).filter((d) => d.count > 0);
  const total = sum(data, (d) => d.count);

  return (
    <Card>
      <SectionTitle
        title="Stock health mix"
        sub={`Every SKU sorted into one state, by weeks of cover against its year-to-date run rate. ${fmtNum(
          total
        )} lines.`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.status} fill={STATUS_STYLE[d.status].color} />
                ))}
              </Pie>
              <Tooltip
                content={<ChartTooltip formatter={(v: number) => `${fmtNum(v)} SKUs`} />}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {data.map((d) => (
            <button
              key={d.status}
              onClick={() => onPick?.(d.status)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors duration-200 ${
                onPick ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: STATUS_STYLE[d.status].color }}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-gray-900" style={MONT}>
                  {d.status}
                </span>
                <span className="block text-[11px] text-gray-500 leading-tight">
                  {STATUS_STYLE[d.status].blurb}
                </span>
              </span>
              <span className="ml-auto text-right shrink-0">
                <span className="block text-[13px] font-bold text-gray-900" style={MONT}>
                  {fmtNum(d.count)}
                </span>
                <span className="block text-[11px] text-gray-500">
                  {((d.count / total) * 100).toFixed(0)}% · {fmtCompact(d.revYTD)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Revenue at risk — the money widget
 * ------------------------------------------------------------------ */

export const RevenueAtRisk: React.FC<{ rows: Sku[]; weeks: number; limit?: number }> = ({
  rows,
  weeks,
  limit = 12,
}) => {
  const outs = useMemo(
    () =>
      rows
        .filter((r) => r.status === 'Stockout')
        .map((r) => ({ ...r, wk: weeklyRev(r, weeks) }))
        .sort((a, b) => b.wk - a.wk),
    [rows, weeks]
  );
  const shown = outs.slice(0, limit);
  const totalRisk = sum(outs, (r) => r.wk);

  const exportAll = () =>
    downloadCsv(
      'revenue-at-risk.csv',
      ['SKU', 'Description', 'Brand', 'Category', 'Class', 'Weekly rev at risk', 'Weekly ROS', 'Back ordered', 'On order', 'Next PO', 'ETA'],
      outs.map((r) => [
        r.sku, r.desc, r.brand, r.category, r.abc, r.wk.toFixed(0), r.ros, r.backOrdered, r.onOrder, r.po ?? '', r.eta ?? '',
      ])
    );

  return (
    <Card>
      <SectionTitle
        title="Revenue at risk"
        sub={`Lines that sold this year but have nothing available today. Weekly figure is each SKU's own year-to-date run rate.`}
        right={
          <button
            onClick={exportAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition-colors duration-200"
            style={MONT}
          >
            <Download size={12} /> CSV
          </button>
        }
      />
      <div className="flex items-baseline gap-3 mb-4 pb-4 border-b border-gray-100">
        <div className="text-3xl font-extrabold tracking-tight" style={{ ...MONT, color: GAF.danger }}>
          {fmtMoney(totalRisk)}
        </div>
        <div className="text-[12px] text-gray-500 leading-snug">
          per week across <strong className="text-gray-900">{outs.length}</strong> stocked-out lines
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty message="No stocked-out selling lines. Rare and excellent." />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-[0.06em] text-[10px]" style={MONT}>
                <th className="py-2 pl-1 font-semibold">SKU</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">$ / week</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Back ord.</th>
                <th className="py-2 pr-1 font-semibold text-right whitespace-nowrap">Inbound</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((r) => (
                <tr key={r.brandGroup + r.sku} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-2.5 pl-1 max-w-[300px]">
                    <div className="font-semibold text-gray-900 truncate" style={MONT}>{r.desc || r.sku}</div>
                    <div className="text-[10.5px] text-gray-400 truncate">
                      <span className="font-mono">{r.sku}</span> · {r.brand}
                      {r.abc !== '—' && <span> · {r.abc}</span>} · sells {r.ros.toFixed(1)}/wk
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold tabular-nums whitespace-nowrap" style={{ ...MONT, color: GAF.danger }}>
                    {fmtMoney(r.wk)}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-gray-600">
                    {r.backOrdered > 0 ? fmtNum(r.backOrdered) : '—'}
                  </td>
                  <td className="py-2.5 pr-1 text-right whitespace-nowrap">
                    {r.eta ? (
                      <>
                        <div className="tabular-nums font-semibold text-gray-900">{fmtNum(r.orderQty || r.onOrder)}</div>
                        <div className="text-[10.5px] text-gray-400">{fmtDate(r.eta)}</div>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold" style={{ color: GAF.danger }}>no PO raised</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {outs.length > shown.length && (
            <div className="text-[11px] text-gray-400 pt-3 pl-1">
              Showing top {shown.length} of {outs.length} — full list in the CSV or the SKU Explorer.
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Dead + slow capital
 * ------------------------------------------------------------------ */

export const SlowCapital: React.FC<{ rows: Sku[]; limit?: number }> = ({ rows, limit = 12 }) => {
  const slow = useMemo(
    () =>
      rows
        .filter((r) => (r.status === 'Dead Stock' || r.status === 'Overstocked') && r.onHand > 0)
        .sort((a, b) => b.onHand - a.onHand),
    [rows]
  );
  const shown = slow.slice(0, limit);

  return (
    <Card>
      <SectionTitle
        title="Slow and dead capital"
        sub="Stock sitting on hand with more than 16 weeks of cover, or no sales at all this year. Ranked by units held."
      />
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-gray-900" style={MONT}>
            {fmtNum(sum(slow, (r) => r.onHand))}
          </div>
          <div className="text-[11px] text-gray-500">units held across {slow.length} lines</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-gray-900" style={MONT}>
            {fmtNum(slow.filter((r) => r.ros === 0).length)}
          </div>
          <div className="text-[11px] text-gray-500">of those have sold nothing all year</div>
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty message="Nothing sitting slow." />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-[0.06em] text-[10px]" style={MONT}>
                <th className="py-2 pl-1 font-semibold">SKU</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">On hand</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Cover</th>
                <th className="py-2 pr-1 font-semibold text-right whitespace-nowrap">Rev YTD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((r) => (
                <tr key={r.brandGroup + r.sku} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-2.5 pl-1 max-w-[300px]">
                    <div className="font-semibold text-gray-900 truncate" style={MONT}>{r.desc || r.sku}</div>
                    <div className="text-[10.5px] text-gray-400 truncate">
                      <span className="font-mono">{r.sku}</span> · {r.brand} · sells {r.ros.toFixed(1)}/wk
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold tabular-nums text-gray-900" style={MONT}>
                    {fmtNum(r.onHand)}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-gray-600 whitespace-nowrap">
                    {r.ros > 0 ? `${fmtNum(Math.min(r.cover, 9999))}w` : 'no sales'}
                  </td>
                  <td className="py-2.5 pr-1 text-right tabular-nums text-gray-600">{fmtCompact(r.revYTD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {slow.length > shown.length && (
            <div className="text-[11px] text-gray-400 pt-3 pl-1">
              Showing top {shown.length} of {slow.length}.
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Cover vs sales rate quadrant
 * ------------------------------------------------------------------ */

const COVER_CAP = 80;

export const CoverQuadrant: React.FC<{ rows: Sku[] }> = ({ rows }) => {
  const data = useMemo(
    () =>
      rows
        .filter((r) => r.ros > 0 && r.revYTD > 0)
        .map((r) => ({
          x: Math.min(r.ros, 40),
          y: r.available <= 0 ? 0 : Math.min(r.cover, COVER_CAP),
          z: Math.max(r.revYTD, 1),
          name: r.desc || r.sku,
          sku: r.sku,
          status: r.status,
          cover: r.cover,
          ros: r.ros,
          rev: r.revYTD,
        })),
    [rows]
  );

  return (
    <Card>
      <SectionTitle
        title="Cover against sales rate"
        sub={`Each bubble is a selling SKU, sized by revenue. Bottom-right is the danger zone — fast sellers with thin cover. Top-left is capital standing still. Axes capped at 40 units/week and ${COVER_CAP} weeks.`}
      />
      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 4 }}>
            <CartesianGrid stroke={GAF.greyPale} />
            {/* Both axes are square-rooted: nearly every SKU lives in the low
                corner on a linear scale and the cloud becomes unreadable. */}
            <XAxis
              type="number"
              dataKey="x"
              name="Weekly units"
              scale="sqrt"
              domain={[0, 40]}
              ticks={[0, 1, 2, 5, 10, 20, 40]}
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: GAF.grey200 }}
              label={{ value: 'Units sold per week', position: 'insideBottom', offset: -12, style: axis }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Weeks cover"
              scale="sqrt"
              domain={[0, COVER_CAP]}
              ticks={[0, 4, 8, 16, 30, 50, COVER_CAP]}
              tick={axis}
              tickLine={false}
              axisLine={{ stroke: GAF.grey200 }}
              label={{ value: 'Weeks cover', angle: -90, position: 'insideLeft', style: axis }}
            />
            <ZAxis type="number" dataKey="z" range={[24, 520]} />
            <ReferenceLine y={4} stroke={GAF.warning} strokeDasharray="4 4" />
            <ReferenceLine y={16} stroke={GAF.info} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: GAF.grey300 }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-[12px] max-w-[260px]">
                    <div className="font-bold text-gray-900 mb-1 leading-tight" style={MONT}>{d.name}</div>
                    <div className="text-[10.5px] text-gray-400 font-mono mb-1.5">{d.sku}</div>
                    <div className="text-gray-600">Cover <strong className="text-gray-900">{fmtNum(d.cover)}w</strong></div>
                    <div className="text-gray-600">Sells <strong className="text-gray-900">{d.ros.toFixed(1)}/wk</strong></div>
                    <div className="text-gray-600">Rev YTD <strong className="text-gray-900">{fmtCompact(d.rev)}</strong></div>
                  </div>
                );
              }}
            />
            <Scatter data={data} fillOpacity={0.75}>
              {data.map((d, i) => (
                <Cell key={i} fill={STATUS_STYLE[d.status as StockStatus].color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
        {STATUS_ORDER.filter((s) => s !== 'Inactive').map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STYLE[s].color }} />
            {s}
          </span>
        ))}
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Category / brand revenue roll-up
 * ------------------------------------------------------------------ */

/** Recharts wraps long category names onto three lines and they collide. Clip instead. */
const CategoryTick: React.FC<any> = ({ x, y, payload }) => {
  const label = String(payload.value);
  const short = label.length > 27 ? `${label.slice(0, 26)}…` : label;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={GAF.grey500} fontSize={11.5}>
      <title>{label}</title>
      {short}
    </text>
  );
};

export const RevenueRollup: React.FC<{
  rows: Sku[];
  title: string;
  sub: string;
  by: (r: Sku) => string;
  limit?: number;
}> = ({ rows, title, sub, by, limit = 10 }) => {
  const data = rollup(rows, by, limit);
  return (
    <Card>
      <SectionTitle title={title} sub={sub} />
      {data.length === 0 ? (
        <Empty message="No revenue recorded." />
      ) : (
        <>
          <div style={{ height: Math.max(180, data.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
                <CartesianGrid horizontal={false} stroke={GAF.greyPale} />
                <XAxis type="number" tick={axis} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={188}
                  tick={<CategoryTick />}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  content={<ChartTooltip formatter={(v: number) => fmtMoney(v)} />}
                />
                <Bar dataKey="revYTD" name="Rev YTD" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? GAF.orange : GAF.grey400} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-gray-500">
            {data.slice(0, 4).map((d) => (
              <div key={d.name} className="min-w-0">
                <div className="truncate font-semibold text-gray-900 text-[12px]" style={MONT}>{d.name}</div>
                <div>{d.skus} SKUs · GP {fmtPct(d.gp)}</div>
                <div className={d.stockouts > 0 ? 'text-[#C23B22]' : ''}>{d.stockouts} stocked out</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Inbound purchase orders
 * ------------------------------------------------------------------ */

export const InboundSchedule: React.FC<{ rows: Sku[] }> = ({ rows }) => {
  const data = inboundByMonth(rows);
  const totalUnits = sum(rows, (r) => r.onOrder);
  const covering = rows.filter((r) => r.status === 'Stockout' && r.orderQty > 0).length;

  return (
    <Card>
      <SectionTitle
        title="Inbound landing schedule"
        sub="Purchase order quantities by the month they are due to arrive."
        right={
          <div className="text-right">
            <div className="text-lg font-extrabold tracking-tight" style={{ ...MONT, color: GAF.orange }}>
              {fmtNum(totalUnits)}
            </div>
            <div className="text-[10.5px] text-gray-500">units on order</div>
          </div>
        }
      />
      {data.length === 0 ? (
        <Empty message="No purchase orders with an ETA." />
      ) : (
        <>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke={GAF.greyPale} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: GAF.grey200 }} />
                <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => fmtNum(v)} />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                  content={<ChartTooltip formatter={(v: number) => `${fmtNum(v)} units`} />}
                />
                <Bar dataKey="units" name="Units landing" fill={GAF.greyDark} radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-[11.5px] text-gray-500">
            <Ship size={14} className="text-gray-400 shrink-0" />
            <span>
              <strong className="text-gray-900">{covering}</strong> of the stocked-out lines have replenishment
              already on a PO. The rest have nothing booked.
            </span>
          </div>
        </>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * ABC classification panel (GAF export only)
 * ------------------------------------------------------------------ */

const ABC_ORDER = ['A', 'B', 'C', 'Non-stocked', 'Obsolete'];

export const AbcPanel: React.FC<{ rows: Sku[] }> = ({ rows }) => {
  const data = ABC_ORDER.map((code) => {
    const rs = rows.filter((r) => r.abc === code);
    const selling = rs.filter((r) => r.ros > 0 || r.unitsYTD > 0);
    return {
      code,
      skus: rs.length,
      revYTD: sum(rs, (r) => r.revYTD),
      onHand: sum(rs, (r) => r.onHand),
      stockouts: rs.filter((r) => r.status === 'Stockout').length,
      availability: selling.length
        ? (selling.filter((r) => r.available > 0).length / selling.length) * 100
        : 0,
    };
  }).filter((d) => d.skus > 0);
  const totalRev = sum(data, (d) => d.revYTD) || 1;

  if (!data.length) return null;

  return (
    <Card>
      <SectionTitle
        title="ABC classification"
        sub="How revenue and availability sit across the replenishment classes. A-lines carry the business, so their availability matters most."
      />
      <div className="space-y-3">
        {data.map((d) => (
          <div key={d.code}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-[13px] font-bold text-gray-900" style={MONT}>{d.code}</span>
              <span className="text-[11px] text-gray-500">
                {d.skus} SKUs · {fmtCompact(d.revYTD)} · {((d.revYTD / totalRev) * 100).toFixed(0)}% of revenue
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((d.revYTD / totalRev) * 100, 0.6)}%`,
                  background: d.code === 'A' ? GAF.orange : GAF.grey400,
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
              <span className={d.stockouts > 0 ? 'text-[#C23B22] font-semibold' : ''}>
                {d.stockouts} stocked out
              </span>
              <span>·</span>
              <span>{d.availability.toFixed(0)}% of selling lines in stock</span>
              <span>·</span>
              <span>{fmtNum(d.onHand)} units on hand</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Margin panel
 * ------------------------------------------------------------------ */

export const MarginPanel: React.FC<{ rows: Sku[]; by: (r: Sku) => string; title: string }> = ({
  rows,
  by,
  title,
}) => {
  const data = rollup(rows.filter((r) => r.revYTD > 0), by)
    .filter((d) => d.gp !== null)
    .slice(0, 8)
    .map((d) => ({ ...d, gp: d.gp as number }));

  return (
    <Card>
      <SectionTitle
        title={title}
        sub="Weighted gross profit percentage year to date — larger lines pull the average, as they should."
      />
      {data.length === 0 ? (
        <Empty message="No margin recorded." />
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GAF.greyPale} />
              <XAxis
                dataKey="name"
                tick={{ ...axis, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: GAF.grey200 }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={54}
              />
              <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />}
              />
              <Bar dataKey="gp" name="GP %" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.gp >= 50 ? GAF.orange : d.gp >= 30 ? GAF.grey400 : GAF.danger} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Top sellers
 * ------------------------------------------------------------------ */

export const TopSellers: React.FC<{ rows: Sku[]; limit?: number }> = ({ rows, limit = 12 }) => {
  const data = useMemo(
    () => [...rows].sort((a, b) => b.revYTD - a.revYTD).slice(0, limit),
    [rows, limit]
  );
  const max = data[0]?.revYTD || 1;

  return (
    <Card>
      <SectionTitle
        title="Top sellers and their cover"
        sub="The revenue engine, with the stock position behind each line. A red badge here is the most expensive kind of problem."
      />
      <div className="space-y-4">
        {data.map((r, i) => (
          <div key={r.brandGroup + r.sku} className="group">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[11px] font-bold text-gray-300 w-5 shrink-0 tabular-nums" style={MONT}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-gray-900 truncate" style={MONT}>
                  {r.desc || r.sku}
                </span>
                <span className="block text-[10.5px] text-gray-400 font-mono truncate">
                  {r.sku} · {r.brand} · {r.available > 0 ? `${fmtNum(r.available)} avail` : 'nil avail'}
                </span>
              </span>
              <StatusBadge status={r.status} small />
              <span className="text-[12.5px] font-bold text-gray-900 tabular-nums w-[68px] text-right shrink-0" style={MONT}>
                {fmtCompact(r.revYTD)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden ml-8">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${Math.max((r.revYTD / max) * 100, 1)}%`,
                  background: i === 0 ? GAF.orange : GAF.grey300,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Backorder watchlist
 * ------------------------------------------------------------------ */

export const BackorderWatch: React.FC<{ rows: Sku[]; limit?: number }> = ({ rows, limit = 10 }) => {
  const data = useMemo(
    () => rows.filter((r) => r.backOrdered > 0).sort((a, b) => b.backOrdered - a.backOrdered),
    [rows]
  );
  const shown = data.slice(0, limit);

  return (
    <Card>
      <SectionTitle
        title="Back-order watchlist"
        sub="Customer orders already taken that stock cannot yet fill. Covered means an inbound PO is at least as big as the back order."
      />
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
        <div>
          <div className="text-2xl font-extrabold tracking-tight" style={{ ...MONT, color: GAF.danger }}>
            {fmtNum(sum(data, (r) => r.backOrdered))}
          </div>
          <div className="text-[11px] text-gray-500">units back-ordered on {data.length} lines</div>
        </div>
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-gray-900" style={MONT}>
            {data.filter((r) => r.onOrder >= r.backOrdered && r.onOrder > 0).length}
          </div>
          <div className="text-[11px] text-gray-500">lines fully covered by inbound stock</div>
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty message="Nothing on back order." />
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-[0.06em] text-[10px]" style={MONT}>
                <th className="py-2 pl-1 font-semibold">SKU</th>
                <th className="py-2 font-semibold text-right">B/O</th>
                <th className="py-2 font-semibold text-right">Inbound</th>
                <th className="py-2 pr-1 font-semibold text-right">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((r) => {
                const covered = r.onOrder >= r.backOrdered && r.onOrder > 0;
                return (
                  <tr key={r.brandGroup + r.sku} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-2.5 pl-1 max-w-[300px]">
                      <div className="font-semibold text-gray-900 truncate" style={MONT}>{r.desc || r.sku}</div>
                      <div className="text-[10.5px] text-gray-400 font-mono">{r.sku} · {r.brand}</div>
                    </td>
                    <td className="py-2.5 text-right font-bold tabular-nums" style={{ ...MONT, color: GAF.danger }}>
                      {fmtNum(r.backOrdered)}
                    </td>
                    <td
                      className="py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: covered ? GAF.success : GAF.grey500 }}
                    >
                      {r.onOrder > 0 ? fmtNum(r.onOrder) : '—'}
                    </td>
                    <td className="py-2.5 pr-1 text-right text-gray-500 whitespace-nowrap">
                      {r.eta ? fmtDate(r.eta) : <span className="text-[#C23B22] font-semibold">no PO</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length > shown.length && (
            <div className="text-[11px] text-gray-400 pt-3 pl-1">
              Showing top {shown.length} of {data.length}.
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

/* ------------------------------------------------------------------ *
 * Action strip — the three things worth doing this week
 * ------------------------------------------------------------------ */

export const ActionStrip: React.FC<{ rows: Sku[]; weeks: number }> = ({ rows, weeks }) => {
  const stockouts = rows.filter((r) => r.status === 'Stockout');
  const noPo = stockouts.filter((r) => !r.po);
  const critical = rows.filter((r) => r.status === 'Critical');
  const dead = rows.filter((r) => r.status === 'Dead Stock' && r.onHand > 0);

  const items = [
    {
      icon: <AlertTriangle size={16} />,
      tone: GAF.danger,
      soft: GAF.dangerSoft,
      head: `${noPo.length} stocked-out lines have no PO raised`,
      body: `Worth ${fmtMoney(sum(noPo, (r) => weeklyRev(r, weeks)))} a week and nothing is booked to fix it.`,
    },
    {
      icon: <Boxes size={16} />,
      tone: GAF.warning,
      soft: GAF.warningSoft,
      head: `${critical.length} lines are under four weeks cover`,
      body: `${fmtNum(sum(critical, (r) => r.available))} units left against ${sum(critical, (r) => r.ros).toFixed(0)} units of weekly demand.`,
    },
    {
      icon: <Snowflake size={16} />,
      tone: GAF.info,
      soft: GAF.infoSoft,
      head: `${fmtNum(sum(dead, (r) => r.onHand))} units are frozen in dead stock`,
      body: `Spread across ${dead.length} lines that have not sold this year.`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_4px_rgba(21,21,19,0.06)] p-4 sm:p-5 flex gap-3"
        >
          <span
            className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
            style={{ background: it.soft, color: it.tone }}
          >
            {it.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-gray-900 leading-snug" style={MONT}>
              {it.head}
            </span>
            <span className="block text-[11.5px] text-gray-500 mt-1 leading-snug">{it.body}</span>
          </span>
        </div>
      ))}
    </div>
  );
};
