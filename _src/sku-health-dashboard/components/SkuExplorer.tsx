import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Search, X } from 'lucide-react';
import type { Sku, StockStatus } from '../types';
import { GAF, STATUS_ORDER } from '../constants';
import { Card, Pill, StatusBadge } from './ui';
import {
  downloadCsv,
  fmtCompact,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  sum,
  weeklyRev,
} from '../utils/metrics';

const MONT = { fontFamily: "'Montserrat', sans-serif" };
const PAGE = 60;

type SortKey =
  | 'revYTD' | 'unitsYTD' | 'cover' | 'onHand' | 'available' | 'onOrder'
  | 'backOrdered' | 'ros' | 'gp' | 'sku' | 'risk';

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right'; width?: string }[] = [
  { key: 'sku', label: 'SKU / description', align: 'left' },
  { key: 'revYTD', label: 'Rev YTD', align: 'right' },
  { key: 'unitsYTD', label: 'Units', align: 'right' },
  { key: 'gp', label: 'GP %', align: 'right' },
  { key: 'ros', label: 'ROS', align: 'right' },
  { key: 'cover', label: 'Cover', align: 'right' },
  { key: 'onHand', label: 'On hand', align: 'right' },
  { key: 'available', label: 'Avail', align: 'right' },
  { key: 'onOrder', label: 'On order', align: 'right' },
  { key: 'backOrdered', label: 'B/O', align: 'right' },
  { key: 'risk', label: '$/wk risk', align: 'right' },
];

const SkuExplorer: React.FC<{ skus: Sku[]; weeks: number }> = ({ skus, weeks }) => {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'All' | 'GAF' | 'Revel'>('All');
  const [status, setStatus] = useState<StockStatus | 'All'>('All');
  const [category, setCategory] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>('revYTD');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const byGroup = useMemo(
    () => (group === 'All' ? skus : skus.filter((s) => s.brandGroup === group)),
    [skus, group]
  );

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    byGroup.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [byGroup]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = byGroup.filter((r) => {
      if (status !== 'All' && r.status !== status) return false;
      if (category !== 'All' && r.category !== category) return false;
      if (!needle) return true;
      return (
        r.sku.toLowerCase().includes(needle) ||
        r.desc.toLowerCase().includes(needle) ||
        r.brand.toLowerCase().includes(needle) ||
        r.subCategory.toLowerCase().includes(needle) ||
        (r.po || '').toLowerCase().includes(needle)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      if (sortKey === 'sku') return a.sku.localeCompare(b.sku) * dir;
      if (sortKey === 'risk')
        return (weeklyRev(a, weeks) * (a.status === 'Stockout' ? 1 : 0) -
          weeklyRev(b, weeks) * (b.status === 'Stockout' ? 1 : 0)) * dir;
      if (sortKey === 'gp') return ((a.gp ?? -999) - (b.gp ?? -999)) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return out;
  }, [byGroup, q, status, category, sortKey, sortDir, weeks]);

  const shown = rows.slice(0, page * PAGE);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key === 'sku' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const exportRows = () =>
    downloadCsv(
      'sku-health-export.csv',
      ['Range', 'SKU', 'Description', 'Brand', 'Category', 'Sub category', 'Class', 'Status',
       'Rev YTD', 'Units YTD', 'GP %', 'Weekly ROS', 'Weeks cover', 'On hand', 'Available',
       'Committed', 'On order', 'Back ordered', 'Next PO', 'ETA', 'Order qty'],
      rows.map((r) => [
        r.brandGroup, r.sku, r.desc, r.brand, r.category, r.subCategory, r.abc, r.status,
        r.revYTD.toFixed(0), r.unitsYTD, r.gp ?? '', r.ros, r.cover, r.onHand, r.available,
        r.committed, r.onOrder, r.backOrdered, r.po ?? '', r.eta ?? '', r.orderQty,
      ])
    );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search SKU code, description, brand, sub category or PO number"
              className="w-full pl-9 pr-9 py-2.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-[#F26422] focus:shadow-[0_0_0_3px_rgba(242,101,34,0.35)] transition-shadow duration-200"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={exportRows}
            className="inline-flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-[0.04em] text-white bg-[#F26422] hover:bg-[#D85418] rounded-full px-5 py-2.5 transition-colors duration-200 shrink-0"
            style={MONT}
          >
            <Download size={14} /> Export {fmtNum(rows.length)} rows
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-2.5">
          {(['All', 'GAF', 'Revel'] as const).map((g) => (
            <Pill
              key={g}
              active={group === g}
              onClick={() => {
                setGroup(g);
                setCategory('All');
                setPage(1);
              }}
            >
              {g === 'GAF' ? 'Gym & Fitness' : g === 'All' ? 'Both ranges' : 'Revel'}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-2.5">
          <Pill active={status === 'All'} onClick={() => { setStatus('All'); setPage(1); }}>
            Any status
          </Pill>
          {STATUS_ORDER.map((s) => (
            <Pill
              key={s}
              active={status === s}
              onClick={() => { setStatus(s); setPage(1); }}
              count={byGroup.filter((r) => r.status === s).length}
            >
              {s}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill active={category === 'All'} onClick={() => { setCategory('All'); setPage(1); }}>
            Any category
          </Pill>
          {categories.map(([c, n]) => (
            <Pill key={c} active={category === c} onClick={() => { setCategory(c); setPage(1); }} count={n}>
              {c}
            </Pill>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          ['Rows matched', fmtNum(rows.length)],
          ['Revenue YTD', fmtCompact(sum(rows, (r) => r.revYTD))],
          ['Units on hand', fmtNum(sum(rows, (r) => r.onHand))],
          ['$/wk at risk', fmtMoney(sum(rows.filter((r) => r.status === 'Stockout'), (r) => weeklyRev(r, weeks)))],
        ].map(([k, v]) => (
          <div key={k} className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_4px_rgba(21,21,19,0.06)] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-semibold" style={MONT}>{k}</div>
            <div className="text-lg font-extrabold tracking-tight text-gray-900 tabular-nums" style={MONT}>{v}</div>
          </div>
        ))}
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[1240px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-gray-200">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`py-3 px-3 font-semibold text-[10px] uppercase tracking-[0.06em] cursor-pointer select-none whitespace-nowrap transition-colors duration-150 ${
                      c.align === 'right' ? 'text-right' : 'text-left'
                    } ${sortKey === c.key ? 'text-[#B34213]' : 'text-gray-400 hover:text-gray-700'}`}
                    style={MONT}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.align === 'right' && sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                      {c.label}
                      {c.align === 'left' && sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </span>
                  </th>
                ))}
                <th className="py-3 px-3 text-left font-semibold text-[10px] uppercase tracking-[0.06em] text-gray-400 whitespace-nowrap" style={MONT}>
                  Status
                </th>
                <th className="py-3 px-3 text-right font-semibold text-[10px] uppercase tracking-[0.06em] text-gray-400 whitespace-nowrap" style={MONT}>
                  Next PO
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((r) => (
                <tr key={r.brandGroup + r.sku} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-2.5 px-3 max-w-[340px]">
                    <div className="font-semibold text-gray-900 truncate" style={MONT}>{r.desc || r.sku}</div>
                    <div className="text-[10.5px] text-gray-400 truncate">
                      <span className="font-mono">{r.sku}</span> · {r.brand} · {r.category}
                      {r.abc !== '—' && <span> · {r.abc}</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-gray-900">{fmtCompact(r.revYTD)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{fmtNum(r.unitsYTD)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{fmtPct(r.gp, 0)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{r.ros.toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">
                    {r.ros > 0 ? `${fmtNum(r.cover)}w` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{fmtNum(r.onHand)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: r.available > 0 ? GAF.greyDark : GAF.danger }}>
                    {fmtNum(r.available)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{fmtNum(r.onOrder)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums" style={{ color: r.backOrdered > 0 ? GAF.danger : GAF.grey400 }}>
                    {r.backOrdered > 0 ? fmtNum(r.backOrdered) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold" style={{ color: r.status === 'Stockout' ? GAF.danger : GAF.grey400 }}>
                    {r.status === 'Stockout' ? fmtMoney(weeklyRev(r, weeks)) : '—'}
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={r.status} small /></td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    {r.po ? (
                      <>
                        <div className="font-mono text-[10.5px] text-gray-500">{r.po}</div>
                        <div className="text-[10.5px] text-gray-400">{fmtDate(r.eta)} · {fmtNum(r.orderQty)}u</div>
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-sm text-gray-400">
                    Nothing matches those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {shown.length < rows.length && (
          <div className="p-4 border-t border-gray-100 text-center">
            <button
              onClick={() => setPage(page + 1)}
              className="text-[12px] font-bold uppercase tracking-[0.04em] text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-full px-6 py-2.5 transition-colors duration-200"
              style={MONT}
            >
              Show more · {fmtNum(shown.length)} of {fmtNum(rows.length)}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SkuExplorer;
