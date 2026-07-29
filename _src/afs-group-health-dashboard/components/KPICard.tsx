import React from 'react';
import { KPIDefinition, KPIResult } from '../types';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, CheckCircle, TrendingUp, TrendingDown, Info, Globe, ExternalLink } from 'lucide-react';
import { BRAND_COLORS } from '../constants';

interface KPICardProps {
  config: KPIDefinition;
  result: KPIResult | null;
  loading: boolean;
}

const KPICard: React.FC<KPICardProps> = ({ config, result, loading }) => {
  if (loading || !result) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse h-48 flex flex-col justify-between">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-16 bg-gray-100 rounded w-full"></div>
      </div>
    );
  }

  // --- Render Custom Progress Card (Force USA BHAG Style) ---
  if (config.visualizationType === 'progress') {
    const percentage = Math.min(Math.round((result.currentValue / result.targetValue) * 100), 100);
    
    return (
      <div className="bg-white rounded-xl shadow-md p-6 flex flex-col justify-between h-full border-l-4 border-l-brand-navy relative overflow-hidden">
        <div>
          <div className="flex justify-between items-start mb-2">
            <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded tracking-wide uppercase">
              FY26 Showroom Critical Number
            </span>
            <div className="flex items-center gap-2">
              {config.sourceLink && (
                <a 
                  href={config.sourceLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-400 hover:text-brand-navy transition-colors" 
                  title="View Source Spreadsheet"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <Globe className="text-blue-500 w-6 h-6 opacity-80" />
            </div>
          </div>
          
          <h3 className="text-4xl font-black text-brand-navy mt-2 tracking-tight">
            {result.currentValue} Stores
          </h3>
          <p className="text-gray-500 text-sm font-medium mt-1">
            in the EU + UK with an Ai1 Unit
          </p>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Current Status</span>
              <div className="font-bold text-lg text-brand-navy">{result.currentValue} Stores</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-brand-navy">{percentage}%</span>
              <div className="text-xs text-gray-500 font-medium">of {result.targetValue} Target</div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-brand-navy h-full rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Standard Sparkline Card ---

  const isSuccess = result.status === 'success';
  const isPercent = config.unit === 'percent';
  const isCurrency = config.unit === 'currency';

  const formatValue = (val: number) => {
    if (isCurrency) return `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    if (isPercent) return `${val.toFixed(2)}%`;
    return Math.round(val).toLocaleString(); 
  };

  const delta = result.currentValue - result.targetValue;
  const isGood = result.status === 'success';
  const hasData = !(result.note && result.currentValue === 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const originalData = result.history.find(h => h.date === label);
      const metadata = originalData?.metadata || data.metadata;
      
      return (
        <div className="bg-brand-navy text-white text-xs p-2 rounded shadow-lg">
          <p className="font-bold mb-1">{label}</p>
          <p>{formatValue(payload[0].value)}</p>
          {metadata && metadata.revenue !== undefined && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <p className="text-gray-300">Revenue: ${metadata.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              <p className="text-gray-300">Expenses: ${metadata.expenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Note: overflow-hidden removed from main div to allow tooltip to pop out
  return (
    <div className={`bg-white rounded-xl shadow-md border-l-4 flex flex-col justify-between transition-transform hover:scale-[1.01] duration-300 relative group ${isSuccess ? 'border-l-emerald-500' : 'border-l-brand-orange'}`}>
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{config.label}</h3>
            {/* Info Tooltip */}
            {config.tooltip && (
              <div className="relative group/tooltip z-50">
                <Info size={14} className="text-gray-400 cursor-help hover:text-brand-navy transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs p-3 rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 text-left leading-relaxed">
                  {config.tooltip}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>
            )}
            {/* Source Link */}
            {config.sourceLink && (
              <a 
                href={config.sourceLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-400 hover:text-brand-navy transition-colors" 
                title="View Source Spreadsheet"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
          {isSuccess ? 
            <CheckCircle className="w-5 h-5 text-emerald-500" /> : 
            <AlertCircle className="w-5 h-5 text-brand-orange" />
          }
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold text-brand-navy">
            {hasData ? formatValue(result.currentValue) : '--'}
          </span>
          <span className="text-xs text-gray-400 font-medium">
            vs Target {formatValue(result.targetValue)}
          </span>
        </div>

        <div className="text-xs flex items-center gap-1 mb-4">
           {result.note ? (
             <span className="text-red-400 italic">{result.note}</span>
           ) : (
             <span className={`${isGood ? 'text-emerald-600' : 'text-brand-orange'} font-semibold flex items-center`}>
               {Math.abs(delta) > 0.01 && (
                  isGood ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>
               )}
               {config.thresholdConfig.operator === '<' 
                  ? (result.currentValue < result.targetValue ? 'Below Max' : 'Above Max')
                  : (result.currentValue > result.targetValue ? 'Above Target' : 'Below Target')
               }
             </span>
           )}
        </div>
      </div>

      {/* Sparkline - Add overflow hidden here so chart doesn't bleed */}
      <div className="h-16 w-full bg-gray-50 overflow-hidden rounded-b-xl">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={result.history}>
            <defs>
              <linearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isGood ? "#10b981" : BRAND_COLORS.orange} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isGood ? "#10b981" : BRAND_COLORS.orange} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={isGood ? "#10b981" : BRAND_COLORS.orange} 
              strokeWidth={2}
              fill={`url(#grad-${config.id})`} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default KPICard;