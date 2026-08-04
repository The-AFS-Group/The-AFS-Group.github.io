import React, { useState, useEffect, useRef } from 'react';
import { KPI_CONFIGS, BUSINESS_UNITS, BRAND_COLORS } from '../constants';
import { KPIDefinition, KPIResult, FilterOptions, CSVRow } from '../types';
import { fetchCSV, processKPI } from '../utils/parsers';
import KPICard from './KPICard';
import { subMonths, format } from 'date-fns';
import { Calendar, ChevronDown, RefreshCw, Activity } from 'lucide-react';

const GroupHealthDashboard: React.FC = () => {
  // Default to one month prior to current (Last Full Month)
  const [filter, setFilter] = useState<FilterOptions>(() => {
    const today = new Date();
    const lastMonth = subMonths(today, 1);
    return {
      month: lastMonth.getMonth(),
      year: lastMonth.getFullYear()
    };
  });

  const [results, setResults] = useState<Record<string, KPIResult>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Date Selector State
  const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateMenuRef.current && !dateMenuRef.current.contains(event.target as Node)) {
        setIsDateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const newResults: Record<string, KPIResult> = {};

    // Group KPIs by URL to avoid over-fetching
    const uniqueUrls = Array.from(new Set(KPI_CONFIGS.map(k => k.dataUrl)));
    const urlDataMap: Record<string, CSVRow[]> = {};

    try {
      // Fetch all unique URLs in parallel
      await Promise.all(uniqueUrls.map(async (url) => {
        try {
          const data = await fetchCSV(url);
          urlDataMap[url] = data;
        } catch (e) {
          console.error(`Failed to fetch ${url}`, e);
          urlDataMap[url] = []; // Fallback empty
        }
      }));

      // Process each KPI
      KPI_CONFIGS.forEach(kpi => {
        const data = urlDataMap[kpi.dataUrl] || [];
        const result = processKPI(kpi, data, filter);
        newResults[kpi.id] = result;
      });

      setResults(newResults);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Global fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  // Generate selectable months (Last 12 months, excluding current)
  const availableMonths = Array.from({ length: 12 }, (_, i) => subMonths(new Date(), i + 1));

  // Group KPIs by Brand
  const gafKPIs = KPI_CONFIGS.filter(k => k.businessUnit === 'GAF');
  const forceKPIs = KPI_CONFIGS.filter(k => k.businessUnit === 'FORCE');
  const revelKPIs = KPI_CONFIGS.filter(k => k.businessUnit === 'REVEL');

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#fdece5] rounded-xl text-brand-orange">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-brand-navy">Group Health</h1>
              <p className="text-xs text-gray-500 font-medium">Cross-brand KPIs vs target</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Month Selector */}
            <div className="relative" ref={dateMenuRef}>
              <button 
                onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                className="flex items-center gap-2 bg-brand-offwhite text-brand-navy px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition select-none"
              >
                <Calendar size={18} />
                <span>{format(new Date(filter.year, filter.month), 'MMMM yyyy')}</span>
                <ChevronDown size={16} className={`transition-transform ${isDateMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown for months */}
              {isDateMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 overflow-y-auto max-h-80 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                   <div className="text-xs text-gray-400 px-2 py-1 uppercase font-bold">Select Period</div>
                   {availableMonths.map((d, i) => {
                      return (
                        <button 
                          key={i}
                          onClick={() => {
                            setFilter({ month: d.getMonth(), year: d.getFullYear() });
                            setIsDateMenuOpen(false);
                          }}
                          className={`w-full text-left px-2 py-2 text-sm rounded transition ${
                            d.getMonth() === filter.month && d.getFullYear() === filter.year 
                            ? 'bg-brand-navy text-white' 
                            : 'text-brand-navy hover:bg-gray-50'
                          }`}
                        >
                          {format(d, 'MMMM yyyy')}
                        </button>
                      )
                   })}
                </div>
              )}
            </div>

            <button 
              onClick={loadData} 
              className="p-2 text-gray-400 hover:text-brand-navy transition rounded-full hover:bg-gray-100"
              title="Refresh Data"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        
        {/* Intro Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[BUSINESS_UNITS.GAF, BUSINESS_UNITS.FORCE, BUSINESS_UNITS.REVEL].map(unit => {
                const unitKPIs = KPI_CONFIGS.filter(k => k.businessUnit === unit.id);
                const unitResults = unitKPIs.map(k => results[k.id]);
                
                let percent = 0;
                let label = "Goal Completion";

                if (unit.id === 'FORCE') {
                   // Special logic for Force: Showroom Target Completion
                   const aioResult = results['force-aio'];
                   if (aioResult && aioResult.targetValue > 0) {
                      percent = Math.min(Math.round((aioResult.currentValue / aioResult.targetValue) * 100), 100);
                   }
                   label = "Showroom Target";
                } else {
                   const passing = unitResults.filter(r => r?.status === 'success').length;
                   const total = unitKPIs.length;
                   percent = total > 0 ? Math.round((passing/total)*100) : 0;
                }
                
                return (
                    <div key={unit.id} className="bg-brand-navy rounded-2xl p-6 text-white flex items-center justify-between shadow-lg relative overflow-hidden">
                         <div className="relative z-10">
                             <div className="flex items-center gap-2 mb-2 opacity-80">
                                 <span className="text-sm font-medium tracking-wider uppercase">{unit.name}</span>
                             </div>
                             <div className="text-4xl font-bold">
                                 {loading ? '-' : `${percent}%`}
                             </div>
                             <div className="text-xs opacity-60 mt-1">{label}</div>
                         </div>
                         {/* Background Decoration */}
                         <div 
                            className="absolute right-0 top-0 h-full w-24 opacity-10 transform scale-150 translate-x-4 translate-y-4"
                            style={{ backgroundColor: unit.color === '#000000' ? '#ffffff' : unit.color }}
                         ></div>
                         
                         {/* Simple status ring */}
                         <div className="relative h-16 w-16">
                            <svg className="h-full w-full" viewBox="0 0 36 36">
                                <path
                                    className="text-white opacity-10"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                                <path
                                    className={`${percent === 100 ? 'text-emerald-400' : 'text-brand-orange'}`}
                                    strokeDasharray={`${percent}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                />
                            </svg>
                         </div>
                    </div>
                )
            })}
        </div>


        {/* GAF Section */}
        <section>
          <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-4">
            <div className="h-12 w-12 bg-white rounded-lg shadow-sm p-2 flex items-center justify-center">
                <img src={BUSINESS_UNITS.GAF.logo} alt="GAF" className="max-h-full max-w-full" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-brand-navy">Gym and Fitness</h2>
                <p className="text-sm text-gray-500">Sales performance and operational metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gafKPIs.map(kpi => (
              <KPICard key={kpi.id} config={kpi} result={results[kpi.id]} loading={loading} />
            ))}
          </div>
        </section>

        {/* Force USA Section */}
        <section>
          <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-4">
             {/* Force USA Logo Container - Changed to White BG */}
             <div className="h-12 w-12 bg-white rounded-lg shadow-sm p-2 flex items-center justify-center">
                <img src={BUSINESS_UNITS.FORCE.logo} alt="Force USA" className="max-h-full max-w-full" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-brand-navy">Force USA</h2>
                <p className="text-sm text-gray-500">Retail presence and market penetration</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forceKPIs.map(kpi => (
              <KPICard key={kpi.id} config={kpi} result={results[kpi.id]} loading={loading} />
            ))}
          </div>
        </section>

        {/* Revel Section */}
        <section>
          <div className="flex items-center gap-4 mb-6 border-b border-gray-200 pb-4">
             {/* Revel Logo Container - Changed to White BG and Inverted logo removed */}
             <div className="h-12 w-12 bg-white rounded-lg shadow-sm p-2 flex items-center justify-center">
                <img src={BUSINESS_UNITS.REVEL.logo} alt="Revel" className="max-h-full max-w-full" />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-brand-navy">Revel Recovery</h2>
                <p className="text-sm text-gray-500">Financial health and logistics efficiency</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {revelKPIs.map(kpi => (
              <KPICard key={kpi.id} config={kpi} result={results[kpi.id]} loading={loading} />
            ))}
          </div>
        </section>

      </main>
      
      <footer className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400 py-8">
        <p>&copy; {new Date().getFullYear()} The AFS Group. Confidential Internal Dashboard.</p>
        <p className="mt-1">Data updated as of {format(lastRefreshed, 'PPpp')}</p>
      </footer>

    </div>
  );
};

export default GroupHealthDashboard;