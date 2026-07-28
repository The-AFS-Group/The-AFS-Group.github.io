
import React, { useState } from 'react';
import { Phone, BarChart3, Menu, X, ShoppingBag, ChevronLeft, ChevronRight, Mountain, Flag } from 'lucide-react';
import CallInsightsDashboard from './CallInsightsDashboard';
import SalesDashboard from './SalesDashboard';
import ProductInsightsDashboard from './ProductInsightsDashboard';
import BHAGDashboard from './BHAGDashboard';
import StrategicPrioritiesDashboard from './StrategicPrioritiesDashboard';
import { GAF_COLORS } from '../constants';

const Dashboard: React.FC = () => {
  // Default to 'sales' view as requested
  const [activeView, setActiveView] = useState<'call-insights' | 'sales' | 'product-insights' | 'bhag' | 'initiatives'>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen flex bg-[#f8f8fa] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[100] bg-black border-r border-white/10
          transform transition-all duration-300 ease-in-out 
          lg:translate-x-0 lg:static lg:inset-auto 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-72 lg:w-64
        `}
      >
        <div className={`flex items-center p-6 border-b border-white/10 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            {!isCollapsed ? (
                 <img
                  src="https://revelsaunas.com.au/cdn/shop/files/REVEL_Logo-White.svg?v=1746587610&width=140"
                  alt="Revel Saunas Logo"
                  className="h-8 w-auto"
                />
            ) : (
                <img
                  src="https://revelsaunas.com.au/cdn/shop/files/REVEL_Logo-White.svg?v=1746587610&width=140"
                  alt="Revel Icon"
                  className="h-8 w-auto object-contain"
                />
            )}
          </div>
          <div className="flex items-center gap-2">
              {/* Mobile Close */}
              <button onClick={toggleSidebar} className="lg:hidden text-gray-400 hover:text-white p-1">
                <X size={24} />
              </button>
              
              {/* Desktop Collapse Toggle */}
              <button 
                onClick={toggleCollapse} 
                className={`hidden lg:flex p-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-white transition-colors ${isCollapsed ? 'absolute -right-3 top-8 bg-black border border-white/10 shadow-sm rounded-full' : ''}`}
              >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
              </button>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          <button
            onClick={() => { setActiveView('sales'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'sales'
                ? 'bg-white/10 text-white shadow-sm border border-white/5'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Sales Health" : ""}
          >
            <BarChart3 size={20} className="shrink-0" />
            {!isCollapsed && <span>Sales Health</span>}
          </button>

          <button
            onClick={() => { setActiveView('bhag'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'bhag'
                ? 'bg-white/10 text-white shadow-sm border border-white/5'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "BHAG" : ""}
          >
            <Mountain size={20} className="shrink-0" />
            {!isCollapsed && <span>BHAG</span>}
          </button>

          <button
            onClick={() => { setActiveView('initiatives'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'initiatives'
                ? 'bg-white/10 text-white shadow-sm border border-white/5'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Strategic Priorities" : ""}
          >
            <Flag size={20} className="shrink-0" />
            {!isCollapsed && <span>Strategic Priorities</span>}
          </button>

          <button
            onClick={() => { setActiveView('product-insights'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'product-insights'
                ? 'bg-white/10 text-white shadow-sm border border-white/5'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Product Insights" : ""}
          >
            <ShoppingBag size={20} className="shrink-0" />
            {!isCollapsed && <span>Product Insights</span>}
          </button>

          <button
            onClick={() => { setActiveView('call-insights'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'call-insights'
                ? 'bg-white/10 text-white shadow-sm border border-white/5'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Call Insights" : ""}
          >
            <Phone size={20} className="shrink-0" />
            {!isCollapsed && <span>Call Insights</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
        {/* Mobile Header Trigger */}
        <div className="lg:hidden bg-black border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
           <img
              src="https://revelsaunas.com.au/cdn/shop/files/REVEL_Logo-White.svg?v=1746587610&width=140"
              alt="Revel Logo"
              className="h-6 w-auto"
            />
          <button onClick={toggleSidebar} className="text-gray-400 p-2 rounded-lg hover:bg-white/10">
            <Menu size={24} />
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1">
          {activeView === 'call-insights' ? (
            <CallInsightsDashboard />
          ) : activeView === 'product-insights' ? (
            <ProductInsightsDashboard />
          ) : activeView === 'bhag' ? (
            <BHAGDashboard />
          ) : activeView === 'initiatives' ? (
            <StrategicPrioritiesDashboard />
          ) : (
            <SalesDashboard />
          )}
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-300"
          onClick={toggleSidebar}
        />
      )}
    </div>
  );
};

export default Dashboard;
