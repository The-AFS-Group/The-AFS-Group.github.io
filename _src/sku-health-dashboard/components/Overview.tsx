import React from 'react';
import { ResponsiveContainer, Bar, BarChart, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { Boxes, DollarSign, Percent, PackageX, Ship, TrendingUp } from 'lucide-react';
import type { Sku } from '../types';
import { GAF, STATUS_ORDER, STATUS_STYLE } from '../constants';
import { Card, ChartTooltip, SectionTitle, StatCard } from './ui';
import {
  ActionStrip,
  InboundSchedule,
  RevenueAtRisk,
  TopSellers,
} from './widgets';
import { fmtCompact, fmtMoney, fmtNum, fmtPct, statusCounts, totals } from '../utils/metrics';

const MONT = { fontFamily: "'Montserrat', sans-serif" };

const BrandCompareRow: React.FC<{ rows: Sku[]; weeks: number; label: string }> = ({
  rows,
  weeks,
  label,
}) => {
  const t = totals(rows, weeks);
  const cells = [
    ['Rev YTD', fmtCompact(t.revYTD)],
    ['Units YTD', fmtNum(t.unitsYTD)],
    ['GP %', fmtPct(t.gp)],
    ['SKUs', fmtNum(t.skus)],
    ['In stock', `${t.availabilityRate.toFixed(0)}%`],
    ['Stocked out', fmtNum(t.stockouts)],
    ['$/wk at risk', fmtMoney(t.revAtRisk)],
    ['On order', fmtNum(t.onOrder)],
  ];
  return (
    <div className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
      <div className="text-[13px] font-bold text-gray-900 mb-2.5" style={MONT}>
        {label}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {cells.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.06em] text-gray-400 font-semibold truncate" style={MONT}>
              {k}
            </div>
            <div className="text-[15px] font-bold text-gray-900 tabular-nums truncate" style={MONT}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusSplit: React.FC<{ gaf: Sku[]; revel: Sku[] }> = ({ gaf, revel }) => {
  const build = (rows: Sku[], name: string) => {
    const counts = statusCounts(rows);
    const total = counts.reduce((s, c) => s + c.count, 0) || 1;
    const out: any = { name };
    counts.forEach((c) => {
      out[c.status] = (c.count / total) * 100;
      out[`${c.status}__n`] = c.count;
    });
    return out;
  };
  const data = [build(gaf, 'Gym & Fitness'), build(revel, 'Revel')];

  return (
    <Card>
      <SectionTitle
        title="Stock health, side by side"
        sub="Share of each range's SKUs in every state. Revel runs a tight catalogue of big-ticket lines; GAF carries a long tail."
      />
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barSize={30}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={108}
              tick={{ fontSize: 12, fill: GAF.greyDark, fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              content={<ChartTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />}
            />
            {STATUS_ORDER.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="a"
                fill={STATUS_STYLE[s].color}
                radius={i === 0 ? [4, 0, 0, 4] : i === STATUS_ORDER.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 pt-3 border-t border-gray-100">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STYLE[s].color }} />
            {s}
          </span>
        ))}
      </div>
    </Card>
  );
};

const RevenueSplit: React.FC<{ gaf: Sku[]; revel: Sku[]; weeks: number }> = ({ gaf, revel }) => {
  const g = gaf.reduce((s, r) => s + r.revYTD, 0);
  const r = revel.reduce((s, r) => s + r.revYTD, 0);
  const data = [
    { name: 'Gym & Fitness', value: g },
    { name: 'Revel', value: r },
  ];
  const total = g + r;

  return (
    <Card>
      <SectionTitle title="Revenue split" sub="Year-to-date revenue across the two ranges." />
      <div className="space-y-4">
        {data.map((d, i) => (
          <div key={d.name}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] font-bold text-gray-900" style={MONT}>{d.name}</span>
              <span className="text-[13px] font-bold text-gray-900 tabular-nums" style={MONT}>
                {fmtCompact(d.value)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.value / total) * 100}%`, background: i === 0 ? GAF.orange : GAF.greyDark }}
              />
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {((d.value / total) * 100).toFixed(1)}% of combined revenue
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-semibold" style={MONT}>
          Combined YTD
        </div>
        <div className="text-2xl font-extrabold tracking-tight" style={{ ...MONT, color: GAF.orange }}>
          {fmtMoney(total)}
        </div>
      </div>
    </Card>
  );
};

const Overview: React.FC<{ skus: Sku[]; weeks: number }> = ({ skus, weeks }) => {
  const gaf = skus.filter((s) => s.brandGroup === 'GAF');
  const revel = skus.filter((s) => s.brandGroup === 'Revel');
  const t = totals(skus, weeks);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard title="Revenue YTD" value={fmtCompact(t.revYTD)} sub={`${fmtNum(t.unitsYTD)} units`} icon={<DollarSign size={18} />} />
        <StatCard title="Revenue MTD" value={fmtCompact(t.revMTD)} sub={`${fmtNum(t.unitsMTD)} units`} icon={<TrendingUp size={18} />} tone="ink" />
        <StatCard title="Weighted GP" value={fmtPct(t.gp)} sub="Year to date" icon={<Percent size={18} />} tone="ink" />
        <StatCard title="Availability" value={`${t.availabilityRate.toFixed(0)}%`} sub={`${fmtNum(t.selling)} selling lines`} icon={<Boxes size={18} />} tone={t.availabilityRate >= 70 ? 'success' : 'warning'} />
        <StatCard title="Stocked out" value={fmtNum(t.stockouts)} sub={`${fmtMoney(t.revAtRisk)} a week at risk`} icon={<PackageX size={18} />} tone="danger" />
        <StatCard title="On order" value={fmtNum(t.onOrder)} sub={`${fmtNum(t.onHand)} units on hand`} icon={<Ship size={18} />} tone="ink" />
      </div>

      <ActionStrip rows={skus} weeks={weeks} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <StatusSplit gaf={gaf} revel={revel} />
        </div>
        <RevenueSplit gaf={gaf} revel={revel} weeks={weeks} />
      </div>

      <Card>
        <SectionTitle
          title="Range scorecard"
          sub={`Both exports on one line each, as at calendar week ${weeks}.`}
        />
        <div className="space-y-4">
          <BrandCompareRow rows={gaf} weeks={weeks} label="Gym & Fitness" />
          <BrandCompareRow rows={revel} weeks={weeks} label="Revel" />
          <BrandCompareRow rows={skus} weeks={weeks} label="Combined" />
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RevenueAtRisk rows={skus} weeks={weeks} />
        <TopSellers rows={skus} />
      </div>

      <InboundSchedule rows={skus} />
    </div>
  );
};

export default Overview;
