import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Menu,
  Snowflake,
  Table2,
  X,
} from 'lucide-react';
import Overview from './components/Overview';
import BrandView from './components/BrandView';
import SkuExplorer from './components/SkuExplorer';
import raw from './data/skuHealth.json';
import type { SkuHealthData } from './types';
import { fmtDate, fmtNum } from './utils/metrics';

const data = raw as unknown as SkuHealthData;
const MONT = { fontFamily: "'Montserrat', sans-serif" };

type View = 'overview' | 'gaf' | 'revel' | 'explorer';

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
  { id: 'gaf', label: 'Gym & Fitness', icon: <Flame size={20} /> },
  { id: 'revel', label: 'Revel', icon: <Snowflake size={20} /> },
  { id: 'explorer', label: 'SKU Explorer', icon: <Table2 size={20} /> },
];

const TITLES: Record<View, { title: string; sub: string }> = {
  overview: {
    title: 'SKU Health',
    sub: 'Stock availability, sell-through and inbound cover across both ranges.',
  },
  gaf: {
    title: 'Gym & Fitness',
    sub: 'Every stocked line in the GAF catalogue, by category, brand and replenishment class.',
  },
  revel: {
    title: 'Revel',
    sub: 'Saunas, ice baths and recovery — a tight range of high-value lines.',
  },
  explorer: {
    title: 'SKU Explorer',
    sub: 'Search, filter, sort and export the full SKU list.',
  },
};

const App: React.FC = () => {
  const initial = (() => {
    if (typeof window === 'undefined') return 'overview';
    const q = new URLSearchParams(window.location.search).get('view');
    return (NAV.some((n) => n.id === q) ? q : 'overview') as View;
  })();

  const [view, setView] = useState<View>(initial);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const gaf = data.skus.filter((s) => s.brandGroup === 'GAF');
  const revel = data.skus.filter((s) => s.brandGroup === 'Revel');

  const go = (id: View) => {
    setView(id);
    setSidebarOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('view', id);
    window.history.replaceState({}, '', url);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen flex bg-[#f8f8fa] font-sans">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[rgba(21,21,19,0.45)] z-[90] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-[100] bg-white border-r border-gray-200
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto lg:h-screen lg:sticky lg:top-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-20' : 'lg:w-64'}
          w-72
        `}
      >
        <div className={`flex items-center p-6 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed ? (
            <img
              src="https://www.gymandfitness.com.au/cdn/shop/files/GAFLogo-Primary_1_360x.png?v=1740540419"
              alt="Gym and Fitness"
              className="h-8 w-auto"
            />
          ) : (
            <img
              src="https://cdn.shopify.com/s/files/1/1950/1891/files/GAF-Icon.png?v=1738497572"
              alt="Gym and Fitness"
              className="h-8 w-8"
            />
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-700 p-1">
              <X size={24} />
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={`hidden lg:flex p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors duration-200 ${
                collapsed ? 'absolute -right-3 top-8 bg-white border border-gray-200 shadow-sm rounded-full' : ''
              }`}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              title={collapsed ? n.label : ''}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                view === n.id
                  ? 'bg-[#FDE9DD] text-[#B34213] shadow-sm border border-[#FBC6A2]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="shrink-0">{n.icon}</span>
              {!collapsed && <span className="text-[14px]" style={MONT}>{n.label}</span>}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-6 pt-4 mt-2 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed">
            <div className="uppercase tracking-[0.08em] font-semibold text-gray-500 mb-1" style={MONT}>
              Data
            </div>
            <div>Refreshed {fmtDate(data.refreshedAt)}</div>
            <div>Calendar week {data.calendarWeek}</div>
            <div>{fmtNum(data.skus.length)} SKUs · {fmtNum(gaf.length)} GAF · {fmtNum(revel.length)} Revel</div>
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-[80] bg-white/90 backdrop-blur-none border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-900 p-1 -ml-1">
              <Menu size={22} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-gray-900 truncate" style={MONT}>
                {TITLES[view].title}
              </h1>
              <p className="text-[11.5px] sm:text-[12.5px] text-gray-500 truncate">{TITLES[view].sub}</p>
            </div>
            <div className="hidden sm:block text-right shrink-0">
              <div className="text-[10px] uppercase tracking-[0.08em] text-gray-400 font-semibold" style={MONT}>
                Week {data.calendarWeek}
              </div>
              <div className="text-[12px] text-gray-600 font-semibold" style={MONT}>
                {fmtDate(data.refreshedAt)}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 max-w-[1600px]">
          {view === 'overview' && <Overview skus={data.skus} weeks={data.weeksElapsed} />}
          {view === 'gaf' && <BrandView rows={gaf} weeks={data.weeksElapsed} variant="GAF" />}
          {view === 'revel' && <BrandView rows={revel} weeks={data.weeksElapsed} variant="Revel" />}
          {view === 'explorer' && <SkuExplorer skus={data.skus} weeks={data.weeksElapsed} />}

          <footer className="mt-10 pt-6 border-t border-gray-200 text-[11px] text-gray-400 leading-relaxed">
            <p>
              Source: SKU Health FY27 stock exports, refreshed {fmtDate(data.refreshedAt)} (calendar week{' '}
              {data.calendarWeek}). Weekly run rates divide year-to-date revenue by {data.weeksElapsed} elapsed weeks.
              Weeks cover, on hand, committed and available come straight from the export; stock health states are
              derived from cover against each SKU's own year-to-date rate of sale.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
