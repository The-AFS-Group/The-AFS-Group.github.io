
import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { 
  Search, PhoneIncoming, AlertTriangle, Sparkles, TrendingUp, TrendingDown, 
  XCircle, Zap, X, Filter, Quote, ArrowRight, MessageSquare, AlertCircle, 
  CheckCircle2, Users, Lightbulb, Target, BookOpen, Truck, Sword, Loader2, ChevronDown, ChevronLeft, ChevronRight,
  Play, User, ExternalLink, MapPin, HelpCircle
} from 'lucide-react';
import { GAF_COLORS, CHART_COLORS, CSV_URL } from '../constants';
import { useCallData } from '../hooks/useCallData';
import { splitList, normalizeSentiment, normalizeDirection, fmt, aggregateThemes } from '../utils/helpers';
import { CallData, SalesRepPerformance } from '../types';
import StatCard from './StatCard';
import Tag from './Tag';
import Empty from './Empty';
import ThemeSection from './ThemeSection';
import FilterStats from './FilterStats';
import { WordCloud } from './WordCloud';

interface ActiveFilter {
    type: string;
    value: string;
}

// Custom Tick Component for Y-Axis to wrap text
const DashboardCustomYAxisTick = ({ x, y, payload, width }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-width - 8} y={-10} width={width} height={40}>
        <div style={{
          fontSize: width < 120 ? '9px' : '11px',
          fontFamily: "'Open Sans', sans-serif",
          color: GAF_COLORS.darkGrey,
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: '100%',
          lineHeight: '1.1',
          wordWrap: 'break-word',
          whiteSpace: 'normal',
          overflow: 'hidden'
        }}>
          {payload.value}
        </div>
      </foreignObject>
    </g>
  );
};

// Reusable card style matching SalesDashboard
const CARD_CLASS = "bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 p-4 md:p-6";

export default function CallInsightsDashboard() {
  const { data, isUpdating, error } = useCallData(CSV_URL);

  const [q, setQ] = useState("");
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pagination states for charts
  const [missingInfoPage, setMissingInfoPage] = useState(1);
  const [contentImprovementPage, setContentImprovementPage] = useState(1);
  const [barriersPage, setBarriersPage] = useState(1);
  const [motivationsPage, setMotivationsPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [competitorsPage, setCompetitorsPage] = useState(1);
  const [triggersPage, setTriggersPage] = useState(1);
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [callsPage, setCallsPage] = useState(1);

  const ITEMS_PER_PAGE = 10;
  const CALLS_PER_PAGE = 15;

  const addFilter = (type: string, value: string) => {
    if (activeFilters.some(f => f.type === type && f.value === value)) return;
    setActiveFilters(prev => [...prev, { type, value }]);
    setCallsPage(1);
  };

  const removeFilter = (index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
    setCallsPage(1);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setQ("");
    setCallsPage(1);
  };

  // Base data filtered ONLY by date (used for FilterStats)
  const rawDataInDateRange = useMemo(() => {
    if (!data) return [];
    if (dateRange === 'all') return data;
    
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateRange === 'yesterday') {
        const yest = new Date();
        yest.setDate(yest.getDate() - 1);
        yest.setHours(0,0,0,0);
        start = yest;
        
        const yestEnd = new Date();
        yestEnd.setDate(yestEnd.getDate() - 1);
        yestEnd.setHours(23,59,59,999);
        end = yestEnd;
    } else if (dateRange === '7d') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '90d') {
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'custom') {
        if (customStart) {
            start = new Date(customStart);
            start.setHours(0,0,0,0);
        }
        if (customEnd) {
            end = new Date(customEnd);
            end.setHours(23,59,59,999);
        }
    }

    return data.filter(row => {
        const dt = row.call_datetime_iso ? new Date(row.call_datetime_iso) : null;
        if (!dt) return false;
        
        if (start && dt < start) return false;
        if (end && dt > end) return false;
        
        return true;
    });
  }, [data, dateRange, customStart, customEnd]);

  // Main filtered data (Date + Analyze Flag + Active Filters)
  const filtered = useMemo(() => {
    return rawDataInDateRange.filter((row) => {
        // 1. Must be analyzable
        if (row.should_analyze !== "TRUE" && row.should_analyze !== true) return false;

        // 2. Process fields for filtering
        const job = row.job_functional || "";
        const barriers = [row.barrier_primary, row.barrier_secondary, row.barrier_tertiary].filter(Boolean);
        const motivations = [row.motivation_primary, row.motivation_secondary, row.motivation_tertiary].filter(Boolean);
        const products = splitList(row.products_mentioned_specific);
        const competitors = splitList(row.competitors_mentioned);
        
        // 3. Apply Text Search (Global Keyword Search)
        if (q) {
            const needle = q.toLowerCase();
            const haystack = [
                row.agent,
                row.call_id,
                row.job_functional,
                row.job_emotional,
                row.job_social,
                row.barrier_primary,
                row.barrier_secondary,
                row.barrier_tertiary,
                row.motivation_primary,
                row.motivation_secondary,
                row.motivation_tertiary,
                row.products_mentioned_specific,
                row.competitors_mentioned,
                row.customer_segment,
                row.equipment_location,
                row.trigger_event_primary,
                row.trigger_event_secondary,
                row.missing_information_critical,
                row.content_improvement_opportunity,
                row.space_details,
                row.space_constraint_level
            ].filter(Boolean).join(" ").toLowerCase();
            if (!haystack.includes(needle)) return false;
        }

        // 4. Apply Active Widgets Filters
        return activeFilters.every(filter => {
            if (filter.type === "BARRIER") return barriers.includes(filter.value);
            if (filter.type === "MOTIVATION") return motivations.includes(filter.value);
            if (filter.type === "PRODUCT") return products.includes(filter.value);
            if (filter.type === "COMPETITOR") return competitors.includes(filter.value);
            if (filter.type === "TRIGGER") return row.trigger_event_primary === filter.value || row.trigger_event_secondary === filter.value;
            if (filter.type === "EQUIPMENT") return row.equipment_location === filter.value;
            if (filter.type === "SEGMENT") return row.customer_segment === filter.value;
            if (filter.type === "DIRECTION") return normalizeDirection(row.direction) === filter.value;
            if (filter.type === "JOB") return (row.job_functional || "") === filter.value;
            if (filter.type === "AGENT") return row.agent === filter.value;
            if (filter.type === "MISSING") return row.missing_information_critical === filter.value;
            if (filter.type === "CONTENT") return row.content_improvement_opportunity === filter.value;
            return true;
        });
    }).map(row => ({
        ...row,
        date: row.call_datetime_iso ? new Date(row.call_datetime_iso) : new Date(),
        direction: normalizeDirection(row.direction),
        sentiment: normalizeSentiment(row.sentiment_label),
        job: row.job_functional || "",
        barriers: [row.barrier_primary, row.barrier_secondary, row.barrier_tertiary].filter(Boolean),
        motivations: [row.motivation_primary, row.motivation_secondary, row.motivation_tertiary].filter(Boolean),
        products: splitList(row.products_mentioned_specific),
        competitor: splitList(row.competitors_mentioned),
        recording_url: (() => {
          if (row.recording_url && row.recording_url.startsWith('http')) return row.recording_url;
          if (row.call_id) return `https://assets.aircall.io/calls/${row.call_id}/recording`;
          return "";
        })(),
    })).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [rawDataInDateRange, q, activeFilters]);

  const weeklyIntel = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const recent = data
        .filter(r => (r.should_analyze === "TRUE" || r.should_analyze === true) && r.call_datetime_iso)
        .map(r => ({ ...r, date: new Date(r.call_datetime_iso) }))
        .filter(r => r.date >= last7Days)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    const previousWeek = data
        .filter(r => (r.should_analyze === "TRUE" || r.should_analyze === true) && r.call_datetime_iso)
        .map(r => ({ ...r, date: new Date(r.call_datetime_iso) }))
        .filter(r => r.date >= lastWeekStart && r.date < last7Days);

    if (recent.length === 0) return null;

    const strategic = [
        { title: "Demand Trend", content: "Growth in high-end strength bundles.", category: "trend", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
        { title: "Market Brief", content: "Competing bundles becoming more aggressive.", category: "market", icon: Sword, color: "text-indigo-600", bg: "bg-indigo-50" },
        { title: "Friction", content: "Shipping timeframe clarity needed.", category: "ops", icon: Truck, color: "text-red-600", bg: "bg-red-50" },
        { title: "Test Idea", content: "Offer free floor mats with cardio rigs.", category: "offer", icon: Lightbulb, color: "text-emerald-600", bg: "bg-emerald-50" },
    ];

    return { count: recent.length, diff: recent.length - previousWeek.length, strategic };
  }, [data]);

  const filteredOutCount = useMemo(() => rawDataInDateRange.filter((r) => r.should_analyze !== "TRUE" && r.should_analyze !== true).length, [rawDataInDateRange]);
  const pctFilteredOut = useMemo(() => rawDataInDateRange.length ? ((filteredOutCount / rawDataInDateRange.length) * 100).toFixed(1) : 0, [rawDataInDateRange, filteredOutCount]);

  // --- ANALYTICS AGGREGATION ---
  const functionalThemes = useMemo(() => aggregateThemes(filtered, "job_functional", "job_functional_theme"), [filtered]);
  const emotionalThemes = useMemo(() => aggregateThemes(filtered, "job_emotional", "job_emotional_theme"), [filtered]);
  const socialThemes = useMemo(() => aggregateThemes(filtered, "job_social", "job_social_theme"), [filtered]);
  
  const getFrequency = (items: any[]) => {
    const freq: Record<string, number> = {};
    items.forEach(item => { freq[item] = (freq[item] || 0) + 1; });
    return Object.entries(freq).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };

  const topBarriers = useMemo(() => getFrequency(filtered.flatMap(r => r.barriers)), [filtered]);
  const topMotivations = useMemo(() => getFrequency(filtered.flatMap(r => r.motivations)), [filtered]);
  const topProducts = useMemo(() => getFrequency(filtered.flatMap(r => r.products)), [filtered]);
  const topCompetitors = useMemo(() => getFrequency(filtered.flatMap(r => r.competitor)), [filtered]);
  const triggerEvents = useMemo(() => getFrequency(filtered.map(r => r.trigger_event_primary).filter(Boolean)), [filtered]);
  const equipmentLocations = useMemo(() => getFrequency(filtered.map(r => r.equipment_location).filter(Boolean)), [filtered]);
  const missingInfo = useMemo(() => getFrequency(filtered.map(r => r.missing_information_critical).filter(Boolean)), [filtered]);
  const contentOpportunities = useMemo(() => getFrequency(filtered.map(r => r.content_improvement_opportunity).filter(Boolean)), [filtered]);

  // Pie Charts Data - Updated to Sage Green (#ABB99C) and Dark Green (#485D4D) palette
  const directionData = useMemo(() => {
      const counts = getFrequency(filtered.map(r => r.direction));
      return counts.map((c, i) => ({ 
        name: c.name, 
        value: c.count, 
        fill: i === 0 ? GAF_COLORS.orange : GAF_COLORS.darkGreen // Sage and Dark Green
      }));
  }, [filtered]);

  const segmentData = useMemo(() => {
      const counts = getFrequency(filtered.map(r => r.customer_segment).filter(Boolean));
      return counts.map((c, i) => ({ 
        name: c.name, 
        value: c.count, 
        fill: i % 2 === 0 ? GAF_COLORS.orange : GAF_COLORS.darkGreen // Sage and Dark Green
      }));
  }, [filtered]);

  // Pagination Logic for Main Table
  const paginatedCalls = useMemo(() => {
      const start = (callsPage - 1) * CALLS_PER_PAGE;
      return filtered.slice(start, start + CALLS_PER_PAGE);
  }, [filtered, callsPage]);

  const renderPagination = (page: number, setPage: (p: any) => void, totalItems: number, itemsPerPage: number = ITEMS_PER_PAGE) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if(totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg bg-gray-100 disabled:opacity-30"><ChevronLeft size={16}/></button>
        <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-tight">Page {page} of {totalPages}</span>
        <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg bg-gray-100 disabled:opacity-30"><ChevronRight size={16}/></button>
      </div>
    );
  };

  const renderBarChartSection = (title: string, sub: string, data: any[], page: number, setPage: React.Dispatch<React.SetStateAction<number>>, color: string, baseWidthY = 160, filterType: string) => {
      const paginated = data.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
      const isMobile = windowWidth < 768;
      const finalWidthY = isMobile ? Math.min(baseWidthY, windowWidth * 0.35) : baseWidthY;

      return (
        <div className={CARD_CLASS}>
            <h3 className="font-extrabold mb-1 uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>{title}</h3>
            <p className="text-[11px] md:text-sm mb-5 text-gray-500 font-medium">{sub}</p>
            {paginated.length ? (
              <>
                <ResponsiveContainer width="100%" height={Math.max(250, paginated.length * 32)}>
                  <BarChart data={paginated} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={finalWidthY} stroke="#94a3b8" tick={<DashboardCustomYAxisTick width={finalWidthY} />} interval={0} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                    <Bar 
                      dataKey="count" 
                      radius={[0, 6, 6, 0]} 
                      fill={color} 
                      onClick={(data: any) => {
                        const name = data?.payload?.name || data?.name;
                        if(name) addFilter(filterType, name);
                      }} 
                      cursor="pointer" 
                    />
                  </BarChart>
                </ResponsiveContainer>
                {renderPagination(page, setPage, data.length)}
              </>
            ) : <Empty loading={isUpdating} />}
        </div>
      );
  }

  const renderPieChartSection = (title: string, data: any[], filterType?: string) => (
      <div className={CARD_CLASS}>
          <h3 className="font-extrabold mb-4 uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>{title}</h3>
          <div className="h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie 
                          data={data} 
                          innerRadius={50} 
                          outerRadius={70} 
                          paddingAngle={2} 
                          dataKey="value"
                      >
                          {data.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.fill || CHART_COLORS[index % CHART_COLORS.length]} 
                                onClick={() => filterType && addFilter(filterType, entry.name)}
                                style={{ cursor: filterType ? 'pointer' : 'default' }}
                              />
                          ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}/>
                      <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        wrapperStyle={{ fontSize: '11px', fontFamily: "'Open Sans', sans-serif" }}
                      />
                  </PieChart>
              </ResponsiveContainer>
          </div>
      </div>
  );

  if (!data && isUpdating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading Call Insights...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto">
            <h1 className="text-base md:text-lg font-extrabold tracking-tight text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Call Insights</h1>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2 mr-2">
                    {activeFilters.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs font-medium">
                            {f.value}
                            <button onClick={() => removeFilter(i)} className="hover:text-orange-900"><X size={12}/></button>
                        </span>
                    ))}
                    <button onClick={clearFilters} className="text-xs text-gray-500 underline hover:text-gray-800">Clear</button>
                </div>
            )}
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs shadow-sm bg-white text-gray-900" 
              />
            </div>
            
            <div className="flex items-center gap-2">
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value)} 
                  className="px-2 py-2 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-1 focus:ring-orange-500 bg-white text-gray-900 outline-none"
                >
                  <option value="yesterday">Yesterday</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>

                {dateRange === 'custom' && (
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 animate-in fade-in slide-in-from-right-2">
                    <input 
                      type="date" 
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-gray-100 text-xs text-gray-700 focus:outline-none focus:border-orange-500 bg-gray-50"
                    />
                    <span className="text-gray-400 text-[10px]">to</span>
                    <input 
                      type="date" 
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-gray-100 text-xs text-gray-700 focus:outline-none focus:border-orange-500 bg-gray-50"
                    />
                  </div>
                )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 md:px-4 py-5 md:py-8 space-y-6 md:space-y-10">
        
        {/* SECTION 1: WEEKLY INTELLIGENCE */}
        {weeklyIntel && (
          <section className={`${CARD_CLASS} border-t-4 border-t-orange-500`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-sm md:text-lg font-extrabold text-gray-900 uppercase tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>Weekly Briefing</h3>
                    <p className="text-[10px] md:text-xs text-gray-500 font-semibold uppercase tracking-widest mt-0.5">Automated Intelligence Summary</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-center bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                    <span className="block text-xl font-black text-gray-900 leading-tight">{weeklyIntel.count}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Calls Analyzed</span>
                  </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
               {weeklyIntel.strategic.map((item: any, idx: number) => (
                <div key={idx} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-2 mb-2">
                       <div className={`p-1.5 rounded-md ${item.bg}`}><item.icon size={14} className={item.color} /></div>
                       <h5 className="text-[10px] md:text-xs font-black text-gray-700 uppercase tracking-tight">{item.title}</h5>
                    </div>
                    <p className="text-[11px] md:text-xs text-gray-600 leading-relaxed font-medium">{item.content}</p>
                </div>
               ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
          <StatCard title="Analyzed" icon={<PhoneIncoming size={18} />} value={fmt(filtered.length)} />
          <StatCard title="Filtered" icon={<XCircle size={18} />} value={`${pctFilteredOut}%`} sub={`${fmt(filteredOutCount)} calls filtered out`} />
          <StatCard title="Insights" icon={<Sparkles size={18} />} value="Live" />
        </div>

        {/* SECTION 2: CALL BREAKDOWN */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Call Breakdown</h2>
          
          {/* Word Cloud */}
          <div className={CARD_CLASS}>
             <div className="flex items-center gap-2 mb-4">
                 <Quote size={18} className="text-orange-500" />
                 <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600">Voice of Customer Cloud</h3>
             </div>
             <WordCloud data={filtered} />
          </div>

          {/* Filter Stats */}
          <FilterStats data={rawDataInDateRange} />

          {/* Demographics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
             {renderPieChartSection("Direction Split", directionData, "DIRECTION")}
             {renderPieChartSection("Customer Segments", segmentData, "SEGMENT")}
          </div>
        </section>

        {/* SECTION 3: JOBS TO BE DONE */}
        <section className="space-y-4 md:space-y-6">
           <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Jobs to be Done</h2>
           <p className="text-sm text-gray-500">Customer jobs organized by theme. Click any theme to see specific jobs mentioned.</p>
           
           <div className="space-y-6">
              <div className={CARD_CLASS}>
                  <h3 className="text-sm md:text-base font-black mb-4 text-blue-600 uppercase tracking-tight">Functional Jobs</h3>
                  <ThemeSection title="Functional" data={functionalThemes} colorIndex={0} loading={isUpdating} onJobClick={(job) => addFilter("JOB", job)} />
              </div>

              <div className={CARD_CLASS}>
                  <h3 className="text-sm md:text-base font-black mb-4 text-pink-600 uppercase tracking-tight">Emotional Jobs</h3>
                  <ThemeSection title="Emotional" data={emotionalThemes} colorIndex={2} loading={isUpdating} onJobClick={(job) => addFilter("JOB", job)} />
              </div>

              {socialThemes.length > 0 && (
                <div className={CARD_CLASS}>
                    <h3 className="text-sm md:text-base font-black mb-4 text-purple-600 uppercase tracking-tight">Social Jobs</h3>
                    <ThemeSection title="Social" data={socialThemes} colorIndex={4} loading={isUpdating} onJobClick={(job) => addFilter("JOB", job)} />
                </div>
              )}
           </div>
        </section>

        {/* SECTION 4: BARRIERS & DRIVERS */}
        <section className="space-y-4 md:space-y-6">
            <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Barriers & Drivers</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {renderBarChartSection("Barriers", "What's preventing purchase?", topBarriers, barriersPage, setBarriersPage, CHART_COLORS[2], 180, "BARRIER")}
                {renderBarChartSection("Motivations", "What's driving purchase intent?", topMotivations, motivationsPage, setMotivationsPage, CHART_COLORS[1], 180, "MOTIVATION")}
            </div>
            
            <div className={CARD_CLASS}>
                <h3 className="font-extrabold mb-1 uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>Trigger Events</h3>
                <p className="text-[11px] md:text-sm mb-5 text-gray-500 font-medium">What prompted customers to call now?</p>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={triggerEvents.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={180} stroke="#94a3b8" tick={<DashboardCustomYAxisTick width={180} />} interval={0} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Bar 
                                dataKey="count" 
                                fill={GAF_COLORS.blue} 
                                radius={[0, 4, 4, 0]} 
                                barSize={20} 
                                onClick={(data: any) => {
                                   const name = data?.payload?.name || data?.name;
                                   if(name) addFilter("TRIGGER", name);
                                }} 
                                cursor="pointer" 
                            />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>

        {/* SECTION 5: PRODUCTS & COMPETITION */}
        <section className="space-y-4 md:space-y-6">
           <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Products & Context</h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {renderBarChartSection("Top Products Mentioned", "Most frequently discussed items", topProducts, productsPage, setProductsPage, GAF_COLORS.orange, 150, "PRODUCT")}
              {renderBarChartSection("Competitor Mentions", "Brands mentioned by customers", topCompetitors, competitorsPage, setCompetitorsPage, GAF_COLORS.green, 150, "COMPETITOR")}
           </div>

           <div className={CARD_CLASS}>
                <div className="flex items-center gap-2 mb-4">
                    <MapPin size={18} className="text-gray-400" />
                    <h3 className="font-extrabold uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>Equipment Location</h3>
                </div>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={equipmentLocations.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={160} stroke="#94a3b8" tick={<DashboardCustomYAxisTick width={160} />} interval={0} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                            <Bar 
                                dataKey="count" 
                                fill={GAF_COLORS.coolGrey} 
                                radius={[0, 4, 4, 0]} 
                                barSize={20} 
                                onClick={(data: any) => {
                                   const name = data?.payload?.name || data?.name;
                                   if(name) addFilter("EQUIPMENT", name);
                                }} 
                                cursor="pointer" 
                            />
                         </BarChart>
                    </ResponsiveContainer>
                </div>
           </div>
        </section>

        {/* SECTION 6: MARKETING OPPORTUNITIES */}
        <section className="space-y-4 md:space-y-6">
            <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Marketing Opportunities</h2>
            
            <div className={CARD_CLASS}>
               <div className="flex items-center gap-2 mb-1">
                   <AlertTriangle size={18} className="text-red-500" />
                   <h3 className="font-extrabold uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>Critical Missing Information</h3>
               </div>
               <p className="text-[11px] md:text-sm mb-5 text-gray-500 font-medium">Key info customers couldn't find</p>
               <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={missingInfo.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                       <XAxis type="number" hide />
                       <YAxis type="category" dataKey="name" width={220} stroke="#94a3b8" tick={<DashboardCustomYAxisTick width={220} />} interval={0} />
                       <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                       <Bar 
                            dataKey="count" 
                            fill={GAF_COLORS.red} 
                            radius={[0, 4, 4, 0]} 
                            barSize={18} 
                            onClick={(data: any) => {
                               const name = data?.payload?.name || data?.name;
                               if(name) addFilter("MISSING", name);
                            }} 
                            cursor="pointer" 
                        />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className={CARD_CLASS}>
               <div className="flex items-center gap-2 mb-1">
                   <Lightbulb size={18} className="text-green-600" />
                   <h3 className="font-extrabold uppercase tracking-tight text-gray-900 text-sm md:text-base" style={{ fontFamily: "'Montserrat', sans-serif" }}>Content Improvement Opportunities</h3>
               </div>
               <p className="text-[11px] md:text-sm mb-5 text-gray-500 font-medium">Website gaps identified by AI</p>
               <div className="h-[300px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contentOpportunities.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                       <XAxis type="number" hide />
                       <YAxis type="category" dataKey="name" width={220} stroke="#94a3b8" tick={<DashboardCustomYAxisTick width={220} />} interval={0} />
                       <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                       <Bar 
                            dataKey="count" 
                            fill={GAF_COLORS.green} 
                            radius={[0, 4, 4, 0]} 
                            barSize={18} 
                            onClick={(data: any) => {
                               const name = data?.payload?.name || data?.name;
                               if(name) addFilter("CONTENT", name);
                            }} 
                            cursor="pointer" 
                        />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>
        </section>

        {/* SECTION 8: RECENT CALLS TABLE */}
        <section className="space-y-4 md:space-y-6">
            <h2 className="text-lg md:text-2xl font-black tracking-tight uppercase text-gray-900" style={{ fontFamily: "'Montserrat', sans-serif" }}>Recent Calls Log</h2>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm border border-gray-200/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Date / Agent</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Conversation Driver</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Barrier</th>
                                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Recording</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paginatedCalls.map((call, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 align-top">
                                        <div className="text-xs font-bold text-gray-900">{call.date.toLocaleDateString()}</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">{call.agent || "Unknown Agent"}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {call.customer_segment ? (
                                            <Tag>{call.customer_segment}</Tag>
                                        ) : <span className="text-xs text-gray-400">-</span>}
                                    </td>
                                    <td className="px-4 py-3 align-top max-w-[200px]">
                                        <div className="text-xs text-gray-800 font-medium truncate" title={call.job}>{call.job || "General Inquiry"}</div>
                                        {call.motivation_primary && <div className="text-[10px] text-gray-500 truncate mt-0.5" title={call.motivation_primary}>Mot: {call.motivation_primary}</div>}
                                    </td>
                                    <td className="px-4 py-3 align-top max-w-[200px]">
                                        {call.barriers.length > 0 ? (
                                            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-block truncate max-w-full">
                                                {call.barriers[0]}
                                            </span>
                                        ) : <span className="text-xs text-gray-400">-</span>}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        {call.recording_url ? (
                                            <a 
                                                href={call.recording_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors"
                                            >
                                                <Play size={12} fill="currentColor" /> Play
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">No audio</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    {renderPagination(callsPage, setCallsPage, filtered.length, CALLS_PER_PAGE)}
                </div>
            </div>
        </section>

      </main>
    </div>
  );
}
