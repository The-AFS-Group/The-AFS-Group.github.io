
import React, { useState } from 'react';
import { Phone, BarChart3, Menu, X, ShoppingBag, ChevronLeft, ChevronRight, Mountain, Target, Flag } from 'lucide-react';
import CallInsightsDashboard from './CallInsightsDashboard';
import SalesDashboard from './SalesDashboard';
import ProductInsightsDashboard from './ProductInsightsDashboard';
import OPSPDashboard from './OPSPDashboard';
import StrategicInitiativesDashboard from './StrategicInitiativesDashboard';
import { GAF_COLORS } from '../constants';

const Dashboard: React.FC = () => {
  // Default to 'sales' view as requested
  const [activeView, setActiveView] = useState<'call-insights' | 'sales' | 'product-insights' | 'opsp' | 'initiatives'>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen flex bg-[#f8f8fa] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-[100] bg-white border-r border-gray-200 
          transform transition-all duration-300 ease-in-out 
          lg:translate-x-0 lg:static lg:inset-auto 
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-72 lg:w-64
        `}
      >
        <div className={`flex items-center p-6 border-b border-gray-100 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3">
            {!isCollapsed ? (
                 <img
                  src="https://www.gymandfitness.com.au/cdn/shop/files/GAFLogo-Primary_1_360x.png?v=1740540419"
                  alt="GAF Logo"
                  className="h-8 w-auto"
                />
            ) : (
                <img
                  src="https://cdn.shopify.com/s/files/1/1950/1891/files/GAF-Icon.png?v=1738497572"
                  alt="GAF Icon"
                  className="h-8 w-8"
                />
            )}
          </div>
          <div className="flex items-center gap-2">
              {/* Mobile Close */}
              <button onClick={toggleSidebar} className="lg:hidden text-gray-500 hover:text-gray-700 p-1">
                <X size={24} />
              </button>
              
              {/* Desktop Collapse Toggle */}
              <button 
                onClick={toggleCollapse} 
                className={`hidden lg:flex p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ${isCollapsed ? 'absolute -right-3 top-8 bg-white border shadow-sm rounded-full' : ''}`}
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
                ? 'bg-[#ffebe3] text-[#F26422] shadow-sm border border-[#ffdbcc]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "Sales Health" : ""}
          >
            <BarChart3 size={20} className="shrink-0" />
            {!isCollapsed && <span>Sales Health</span>}
          </button>

          <button
            onClick={() => { setActiveView('opsp'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'opsp'
                ? 'bg-[#ffebe3] text-[#F26422] shadow-sm border border-[#ffdbcc]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            } ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? "OPSP" : ""}
          >
            <Target size={20} className="shrink-0" />
            {!isCollapsed && <span>OPSP</span>}
          </button>

          <button
            onClick={() => { setActiveView('initiatives'); setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
              activeView === 'initiatives'
                ? 'bg-[#ffebe3] text-[#F26422] shadow-sm border border-[#ffdbcc]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-[#ffebe3] text-[#F26422] shadow-sm border border-[#ffdbcc]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                ? 'bg-[#ffebe3] text-[#F26422] shadow-sm border border-[#ffdbcc]'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
           <img
              src="https://www.gymandfitness.com.au/cdn/shop/files/GAFLogo-Primary_1_360x.png?v=1740540419"
              alt="GAF Logo"
              className="h-6 w-auto"
            />
          <button onClick={toggleSidebar} className="text-gray-600 p-2 rounded-lg hover:bg-gray-100">
            <Menu size={24} />
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1">
          {activeView === 'product-insights' ? (
            <ProductInsightsDashboard />
          ) : activeView === 'opsp' ? (
            <OPSPDashboard />
          ) : activeView === 'initiatives' ? (
            <StrategicInitiativesDashboard />
          ) : activeView === 'call-insights' ? (
            <CallInsightsDashboard />
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
