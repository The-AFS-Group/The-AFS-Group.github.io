import React, { useMemo, useState } from 'react';
import { Boxes, DollarSign, PackageX, Percent, Ship, Snowflake, TrendingUp } from 'lucide-react';
import type { Sku } from '../types';
import { Pill, StatCard } from './ui';
import {
  AbcPanel,
  ActionStrip,
  BackorderWatch,
  CoverQuadrant,
  InboundSchedule,
  MarginPanel,
  RevenueAtRisk,
  RevenueRollup,
  SlowCapital,
  StockHealthMix,
  TopSellers,
} from './widgets';
import { fmtCompact, fmtMoney, fmtNum, fmtPct, totals } from '../utils/metrics';

interface Props {
  rows: Sku[];
  weeks: number;
  /** GAF splits by master category and carries ABC codes; Revel does neither. */
  variant: 'GAF' | 'Revel';
}

const BrandView: React.FC<Props> = ({ rows, weeks, variant }) => {
  const [category, setCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filtered = useMemo(
    () => (category === 'All' ? rows : rows.filter((r) => r.category === category)),
    [rows, category]
  );

  const t = totals(filtered, weeks);

  return (
    <div className="space-y-5">
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Pill active={category === 'All'} onClick={() => setCategory('All')} count={rows.length}>
            All categories
          </Pill>
          {categories.map(([c, n]) => (
            <Pill key={c} active={category === c} onClick={() => setCategory(c)} count={n}>
              {c}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard title="Revenue YTD" value={fmtCompact(t.revYTD)} sub={`${fmtNum(t.unitsYTD)} units`} icon={<DollarSign size={18} />} />
        <StatCard title="Revenue MTD" value={fmtCompact(t.revMTD)} sub={`${fmtNum(t.unitsMTD)} units`} icon={<TrendingUp size={18} />} tone="ink" />
        <StatCard title="Weighted GP" value={fmtPct(t.gp)} sub="Year to date" icon={<Percent size={18} />} tone="ink" />
        <StatCard title="Availability" value={`${t.availabilityRate.toFixed(0)}%`} sub={`${fmtNum(t.selling)} selling lines`} icon={<Boxes size={18} />} tone={t.availabilityRate >= 70 ? 'success' : 'warning'} />
        <StatCard title="Stocked out" value={fmtNum(t.stockouts)} sub={`${fmtMoney(t.revAtRisk)} a week at risk`} icon={<PackageX size={18} />} tone="danger" />
        <StatCard title="Dead capital" value={fmtNum(t.deadCapitalUnits)} sub={`units across ${t.deadCapitalSkus} lines`} icon={<Snowflake size={18} />} tone="info" />
      </div>

      <ActionStrip rows={filtered} weeks={weeks} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <StockHealthMix rows={filtered} />
        {variant === 'GAF' ? (
          <AbcPanel rows={filtered} />
        ) : (
          <RevenueRollup
            rows={filtered}
            by={(r) => r.category}
            title="Revenue by range"
            sub="Year-to-date revenue by product family."
          />
        )}
      </div>

      <CoverQuadrant rows={filtered} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RevenueAtRisk rows={filtered} weeks={weeks} />
        <SlowCapital rows={filtered} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <TopSellers rows={filtered} />
        <BackorderWatch rows={filtered} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {variant === 'GAF' ? (
          <RevenueRollup
            rows={filtered}
            by={(r) => r.brand}
            title="Revenue by brand"
            sub="Top brands by year-to-date revenue, with stock trouble flagged underneath."
          />
        ) : (
          <RevenueRollup
            rows={filtered}
            by={(r) => r.brand}
            title="Revenue by label"
            sub="Revel's own lines against the Harvia componentry it sells alongside them."
          />
        )}
        <MarginPanel
          rows={filtered}
          by={(r) => r.category}
          title={variant === 'GAF' ? 'Margin by master category' : 'Margin by range'}
        />
      </div>

      {variant === 'GAF' && (
        <RevenueRollup
          rows={filtered}
          by={(r) => r.subCategory}
          title="Revenue by sub category"
          sub="Where the money actually sits inside the master categories."
          limit={12}
        />
      )}

      <InboundSchedule rows={filtered} />
    </div>
  );
};

export default BrandView;
