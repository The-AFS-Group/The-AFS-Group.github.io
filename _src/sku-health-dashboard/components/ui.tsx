import React from 'react';
import { GAF, STATUS_STYLE } from '../constants';
import type { StockStatus } from '../types';

const MONT = { fontFamily: "'Montserrat', sans-serif" };

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}> = ({ children, className = '', padded = true }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-200 shadow-[0_2px_4px_rgba(21,21,19,0.06)] ${
      padded ? 'p-5 sm:p-6' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const SectionTitle: React.FC<{
  title: string;
  sub?: string;
  right?: React.ReactNode;
}> = ({ title, sub, right }) => (
  <div className="flex items-start justify-between gap-4 mb-5">
    <div className="min-w-0">
      <h3 className="text-base sm:text-lg font-bold tracking-tight text-gray-900" style={MONT}>
        {title}
      </h3>
      {sub && <p className="text-xs sm:text-[13px] text-gray-500 mt-1 leading-snug">{sub}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </div>
);

export const StatCard: React.FC<{
  title: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: 'accent' | 'ink' | 'danger' | 'success' | 'warning' | 'info';
}> = ({ title, value, sub, icon, tone = 'accent' }) => {
  const color = {
    accent: GAF.orange,
    ink: GAF.black,
    danger: GAF.danger,
    success: GAF.success,
    warning: '#8A5C00',
    info: GAF.info,
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_4px_rgba(21,21,19,0.06)] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[10px] sm:text-[11px] text-gray-500 uppercase tracking-[0.08em] font-semibold truncate"
            style={MONT}
          >
            {title}
          </div>
          <div
            className="mt-1.5 text-xl sm:text-2xl tracking-tight truncate"
            style={{ ...MONT, color, fontWeight: 800 }}
          >
            {value}
          </div>
          {sub && <div className="text-[11px] text-gray-500 mt-1 leading-snug">{sub}</div>}
        </div>
        {icon && <div className="text-gray-300 shrink-0 mt-0.5">{icon}</div>}
      </div>
    </div>
  );
};

export const StatusBadge: React.FC<{ status: StockStatus; small?: boolean }> = ({
  status,
  small,
}) => {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${
        small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
      style={{ ...MONT, background: s.soft, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {status}
    </span>
  );
};

export const Pill: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}> = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all duration-200 ${
      active
        ? 'bg-[#FDE9DD] text-[#B34213] border-[#F8A373]'
        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
    }`}
    style={MONT}
  >
    {children}
    {count !== undefined && (
      <span className={active ? 'ml-1.5 opacity-70' : 'ml-1.5 text-gray-400'}>{count}</span>
    )}
  </button>
);

/** Recharts default tooltip is too loud for this system — this one matches the cards. */
export const ChartTooltip: React.FC<any> = ({ active, payload, label, formatter }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-[12px]">
      {label !== undefined && (
        <div className="font-bold text-gray-900 mb-1" style={MONT}>
          {label}
        </div>
      )}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-gray-600">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color || p.fill }}
          />
          <span>{p.name}</span>
          <span className="font-semibold text-gray-900 ml-auto pl-3">
            {formatter ? formatter(p.value, p.name, p) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const Empty: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-sm text-gray-400 py-10">{message}</div>
);
