import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, AreaChart, Area } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Target, Ship, FileText, Percent, Info, Trophy } from 'lucide-react';
import { fetchBHAGData, getCachedData, isCacheStale } from '../services/dataService';
import { BhagData } from '../types';
import { GAF_COLORS } from '../constants';
import { UpdatingBadge } from './UpdatingBadge';

const RecoveryTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(label);
    const formattedLabel = isNaN(date.getTime()) ? label : date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    
    return (
      <div className="bg-white p-3 rounded-xl shadow-lg border border-gray-100 text-sm min-w-[200px]">
        <p className="font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">{formattedLabel}</p>
        <div className="flex justify-between gap-4 mb-2">
          <span className="text-gray-500">Recovery Rate:</span>
          <span className="font-bold text-emerald-600">{data.rate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4 mb-2">
          <span className="text-gray-500">Revenue:</span>
          <span className="font-bold text-blue-600">${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Expenses:</span>
          <span className="font-bold text-red-600">${data.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    );
  }
  return null;
};

const BHAGDashboard: React.FC = () => {
  const cacheKey = 'bhag_data';
  const cachedData = getCachedData<BhagData>(cacheKey);
  const [data, setData] = useState<BhagData | null>(cachedData || null);
  const [isUpdating, setIsUpdating] = useState(!cachedData || isCacheStale(cacheKey));

  useEffect(() => {
    const load = async (force = false) => {
      if (!force && !isCacheStale(cacheKey)) {
          setIsUpdating(false);
          return;
      }
      setIsUpdating(true);
      const result = await fetchBHAGData(force);
      setData(result);
      setIsUpdating(false);
    };
    load();
    const interval = setInterval(() => load(true), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data && isUpdating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading BHAG Data...</p>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center">No Data Available</div>;

  // Helpers for current metrics (assuming last entry is current)
  const currentShipping = data.shippingRecovery[data.shippingRecovery.length - 1];
  const currentInstall = data.installRecovery?.[data.installRecovery.length - 1];
  const currentCredit = data.creditMemos[data.creditMemos.length - 1];
  const currentGP = data.gp[data.gp.length - 1];
  const currentDiscount = data.salesDiscount[data.salesDiscount.length - 1];

  const shippingTarget = 90;
  const installTarget = 90;
  const creditTarget = data.creditMemos.length > 0 
    ? data.creditMemos.reduce((sum, d) => sum + d.rate, 0) / data.creditMemos.length 
    : 0;
  const gpTarget = 40;
  const discountTarget = 10;

  const currentShippingRate = currentShipping ? currentShipping.rate : 0;
  const currentInstallRate = currentInstall ? currentInstall.rate : 0;
  const currentCreditRate = currentCredit ? currentCredit.rate : 0;
  const currentGPMargin = currentGP ? currentGP.margin : 0;
  const currentDiscountRate = currentDiscount ? currentDiscount.rate : 0;

  const isShippingGood = currentShippingRate >= shippingTarget;
  const isInstallGood = currentInstallRate >= installTarget;
  const isCreditGood = currentCreditRate < creditTarget;
  const isGPGood = currentGPMargin >= gpTarget;
  const isDiscountGood = currentDiscountRate < discountTarget;

  return (
    <div className="min-h-screen bg-[#f8f8fa] p-4 md:p-6 space-y-8">
       {/* Hero BHAG Section - Clean Gradient Style */}
       <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black shadow-xl border border-white/5">
          <div className="relative z-10 px-6 py-12 md:py-20 flex flex-col items-center justify-center text-center space-y-6">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white tracking-wider uppercase">
                <Trophy size={14} className="text-yellow-400" />
                Business Unit BHAG
             </div>
             
             <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white max-w-4xl leading-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
               "Reaching 100,000 members by January 1st, 2030."
             </h1>
             
             <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Progress</span>
                <span className="text-2xl md:text-4xl font-bold text-orange-500" style={{ fontFamily: "'Montserrat', sans-serif" }}>TBA</span>
             </div>
          </div>
       </div>

       {/* Critical Numbers Header */}
       <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
             <Target size={24} />
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Critical Numbers (FY26)</h2>
       </div>

       {/* Widgets Grid */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Shipping Recovery */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative">
             <UpdatingBadge isUpdating={isUpdating} />
             <div className="flex justify-between items-start mb-6">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <Ship size={18} className="text-blue-500" />
                      <h3 className="font-bold text-gray-900">Shipping Recovery</h3>
                      <div className="group relative flex items-center">
                        <Info size={14} className="text-gray-400 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full translate-y-2 pb-4 hidden group-hover:block w-64 z-10">
                          <div className="p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                            Source: <a href="https://docs.google.com/spreadsheets/d/1YGymlROOHtIDLAldqsujKR4nIdHXJcn3Kr8cSwXe71c/edit?gid=949589139#gid=949589139" target="_blank" rel="noreferrer" className="text-blue-300 hover:underline break-all">Shipping Recovery Tracking</a>
                          </div>
                        </div>
                      </div>
                   </div>
                   <p className="text-xs text-gray-500">Target: &gt; 90%</p>
                </div>
                <div className="text-right">
                   <div className={`text-2xl font-bold ${isShippingGood ? 'text-emerald-600' : 'text-red-500'}`}>
                      {currentShipping ? `${currentShipping.rate.toFixed(1)}%` : '0%'}
                   </div>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isShippingGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {isShippingGood ? 'On Track' : 'Off Track'}
                   </span>
                </div>
             </div>
             <div className="h-64 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={data.shippingRecovery}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} 
                        tickFormatter={(val) => {
                          const date = new Date(val);
                          return isNaN(date.getTime()) ? val : date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
                        }}
                      />
                      <YAxis domain={[0, 200]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                      <Tooltip content={<RecoveryTooltip />} />
                      <ReferenceLine y={90} stroke={GAF_COLORS.green} strokeDasharray="3 3" label={{ value: 'Target 90%', position: 'insideTopRight', fill: GAF_COLORS.green, fontSize: 10 }} />
                      <Line type="monotone" dataKey="rate" stroke="#94a3b8" strokeWidth={3} activeDot={{ r: 6 }} name="rate" dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        if (cx == null || cy == null || isNaN(cx) || isNaN(cy) || !payload) return <g key={`dot-${index}`} />;
                        const isGood = payload.rate >= 90;
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={isGood ? "#10b981" : "#ef4444"} stroke="none" />;
                      }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* 1b. Install Recovery */}
          {data.installRecovery && data.installRecovery.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative">
               <UpdatingBadge isUpdating={isUpdating} />
               <div className="flex justify-between items-start mb-6">
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <Target size={18} className="text-teal-500" />
                        <h3 className="font-bold text-gray-900">Install Recovery</h3>
                        <div className="group relative flex items-center">
                          <Info size={14} className="text-gray-400 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full translate-y-2 pb-4 hidden group-hover:block w-64 z-10">
                            <div className="p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                              Source: <a href="https://docs.google.com/spreadsheets/d/1YGymlROOHtIDLAldqsujKR4nIdHXJcn3Kr8cSwXe71c/edit?gid=949589139#gid=949589139" target="_blank" rel="noreferrer" className="text-blue-300 hover:underline break-all">Install Recovery Tracking</a>
                            </div>
                          </div>
                        </div>
                     </div>
                     <p className="text-xs text-gray-500">Target: &gt; 90%</p>
                  </div>
                  <div className="text-right">
                     <div className={`text-2xl font-bold ${isInstallGood ? 'text-emerald-600' : 'text-red-500'}`}>
                        {currentInstall ? `${currentInstall.rate.toFixed(1)}%` : '0%'}
                     </div>
                     <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isInstallGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {isInstallGood ? 'On Track' : 'Off Track'}
                     </span>
                  </div>
               </div>
               <div className="h-64 w-full mt-auto">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={data.installRecovery}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} 
                          tickFormatter={(val) => {
                            const date = new Date(val);
                            return isNaN(date.getTime()) ? val : date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
                          }}
                        />
                        <YAxis domain={[0, 200]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} />
                        <Tooltip content={<RecoveryTooltip />} />
                        <ReferenceLine y={90} stroke={GAF_COLORS.green} strokeDasharray="3 3" label={{ value: 'Target 90%', position: 'insideTopRight', fill: GAF_COLORS.green, fontSize: 10 }} />
                        <Line type="monotone" dataKey="rate" stroke="#94a3b8" strokeWidth={3} activeDot={{ r: 6 }} name="rate" dot={(props: any) => {
                          const { cx, cy, payload, index } = props;
                          if (cx == null || cy == null || isNaN(cx) || isNaN(cy) || !payload) return <g key={`dot-${index}`} />;
                          const isGood = payload.rate >= 90;
                          return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={isGood ? "#10b981" : "#ef4444"} stroke="none" />;
                        }} />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>
          )}

          {/* 2. Credit Memos */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative">
             <UpdatingBadge isUpdating={isUpdating} />
             <div className="flex justify-between items-start mb-6">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <FileText size={18} className="text-purple-500" />
                      <h3 className="font-bold text-gray-900">Weekly Credits</h3>
                      <div className="group relative flex items-center">
                        <Info size={14} className="text-gray-400 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full translate-y-2 pb-4 hidden group-hover:block w-64 z-10">
                          <div className="p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                            Source: <a href="https://docs.google.com/spreadsheets/d/1VZ5m0q4h6bWS86CZBHaEVunEqAW6AtsZCDm4222GJ3g/edit?gid=1995533469#gid=1995533469" target="_blank" rel="noreferrer" className="text-blue-300 hover:underline break-all">Weekly Credits/Refunds Tracking</a>
                          </div>
                        </div>
                      </div>
                   </div>
                   <p className="text-xs text-gray-500">Target: Period Average</p>
                </div>
                <div className="text-right">
                   <div className={`text-2xl font-bold ${isCreditGood ? 'text-emerald-600' : 'text-red-500'}`}>
                      {currentCredit ? `$${currentCredit.rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                   </div>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCreditGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {isCreditGood ? 'Below Avg' : 'Above Avg'}
                   </span>
                </div>
             </div>
             <div className="h-64 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={data.creditMemos}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                      <Tooltip 
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                         formatter={(val: number) => [`$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Credit Amount']}
                      />
                      <ReferenceLine y={creditTarget} stroke={GAF_COLORS.green} strokeDasharray="3 3" label={{ value: `Avg ${creditTarget >= 1000 ? '$' + (creditTarget/1000).toFixed(1) + 'k' : '$' + creditTarget.toFixed(0)}`, position: 'insideTopRight', fill: GAF_COLORS.green, fontSize: 10 }} />
                      <Line type="monotone" dataKey="rate" stroke="#94a3b8" strokeWidth={3} activeDot={{ r: 6 }} dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        if (cx == null || cy == null || isNaN(cx) || isNaN(cy) || !payload) return <g key={`dot-${index}`} />;
                        const isGood = payload.rate < creditTarget;
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={isGood ? "#10b981" : "#ef4444"} stroke="none" />;
                      }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* 3. GP % */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative">
             <UpdatingBadge isUpdating={isUpdating} />
             <div className="flex justify-between items-start mb-6">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={18} className="text-orange-500" />
                      <h3 className="font-bold text-gray-900">Weekly GP Margin</h3>
                      <div className="group relative flex items-center">
                        <Info size={14} className="text-gray-400 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full translate-y-2 pb-4 hidden group-hover:block w-64 z-10">
                          <div className="p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                            Source: <a href="https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519#gid=1965640519" target="_blank" rel="noreferrer" className="text-blue-300 hover:underline break-all">REVEL Main Dataset</a>
                          </div>
                        </div>
                      </div>
                   </div>
                   <p className="text-xs text-gray-500">Target: &ge; 40%</p>
                </div>
                <div className="text-right">
                   <div className={`text-2xl font-bold ${isGPGood ? 'text-emerald-600' : 'text-red-500'}`}>
                      {currentGP ? `${currentGP.margin.toFixed(2)}%` : '0%'}
                   </div>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isGPGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {isGPGood ? 'On Track' : 'Off Track'}
                   </span>
                </div>
             </div>
             <div className="h-64 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={data.gp}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                         formatter={(val: number) => [`${val.toFixed(2)}%`, 'GP Margin']}
                      />
                      <ReferenceLine y={40} stroke={GAF_COLORS.green} strokeDasharray="3 3" label={{ value: 'Target 40%', position: 'insideTopRight', fill: GAF_COLORS.green, fontSize: 10 }} />
                      <Line type="monotone" dataKey="margin" stroke="#94a3b8" strokeWidth={3} activeDot={{ r: 6 }} dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        if (cx == null || cy == null || isNaN(cx) || isNaN(cy) || !payload) return <g key={`dot-${index}`} />;
                        const isGood = payload.margin >= 40;
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={isGood ? "#10b981" : "#ef4444"} stroke="none" />;
                      }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* 4. Sales Discount */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col relative">
             <UpdatingBadge isUpdating={isUpdating} />
             <div className="flex justify-between items-start mb-6">
                <div>
                   <div className="flex items-center gap-2 mb-1">
                      <Percent size={18} className="text-rose-500" />
                      <h3 className="font-bold text-gray-900">Sales Discount %</h3>
                      <div className="group relative flex items-center">
                        <Info size={14} className="text-gray-400 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full translate-y-2 pb-4 hidden group-hover:block w-64 z-10">
                          <div className="p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                            Source: <a href="https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit?gid=1965640519#gid=1965640519" target="_blank" rel="noreferrer" className="text-blue-300 hover:underline break-all">REVEL Main Dataset</a>
                          </div>
                        </div>
                      </div>
                   </div>
                   <p className="text-xs text-gray-500">Target: &lt; 10%</p>
                </div>
                <div className="text-right">
                   <div className={`text-2xl font-bold ${isDiscountGood ? 'text-emerald-600' : 'text-red-500'}`}>
                      {currentDiscount ? `${currentDiscount.rate.toFixed(2)}%` : '0%'}
                   </div>
                   <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDiscountGood ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {isDiscountGood ? 'On Track' : 'Off Track'}
                   </span>
                </div>
             </div>
             <div className="h-64 w-full mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={data.salesDiscount}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip 
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                         formatter={(val: number) => [`${val.toFixed(2)}%`, 'Discount Rate']}
                      />
                      <ReferenceLine y={10} stroke={GAF_COLORS.green} strokeDasharray="3 3" label={{ value: 'Target 10%', position: 'insideTopRight', fill: GAF_COLORS.green, fontSize: 10 }} />
                      <Line type="monotone" dataKey="rate" stroke="#94a3b8" strokeWidth={3} activeDot={{ r: 6 }} dot={(props: any) => {
                        const { cx, cy, payload, index } = props;
                        if (cx == null || cy == null || isNaN(cx) || isNaN(cy) || !payload) return <g key={`dot-${index}`} />;
                        const isGood = payload.rate < 10;
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill={isGood ? "#10b981" : "#ef4444"} stroke="none" />;
                      }} />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

       </div>
    </div>
  );
};

export default BHAGDashboard;