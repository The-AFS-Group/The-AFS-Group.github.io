import React from 'react';
import { GAF_COLORS } from '../constants';

interface StatCardProps {
  title: string;
  icon: React.ReactNode;
  value: string | number;
  sub?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, icon, value, sub, className = "" }) => {
  return (
    <div
      className={`rounded-2xl border border-white/20 backdrop-blur-xl bg-white/80 text-foreground p-3 sm:p-5 shadow-lg ${className}`}
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-sm text-gray-600 truncate uppercase tracking-wider font-semibold" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {title}
          </div>
          <div
            className="mt-1 text-xl sm:text-2xl font-bold tracking-tight truncate"
            style={{
              color: GAF_COLORS.orange,
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
            }}
          >
            {value}
          </div>
          {sub && <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 font-medium">{sub}</div>}
        </div>
        <div className="text-gray-400 shrink-0 mt-0.5">
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;