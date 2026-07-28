import React, { useState } from 'react';
import { BarChart3, Menu, X, ChevronLeft, ChevronRight, Target, Flag } from 'lucide-react';
import SalesHealthDashboard from './SalesHealthDashboard';
import OPSPDashboard from './OPSPDashboard';
import StrategicPrioritiesDashboard from './StrategicPrioritiesDashboard';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'sales' | 'opsp' | 'initiatives'>('sales');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const navButton = (view: typeof activeView, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => { setActiveView(view); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
        activeView === view
          ? 'bg-[#d6e6f5] text-[#185787] shadow-sm border border-[#b8d4ed]'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      } ${isCollapsed ? 'justify-center' : ''}`}
      title={isCollapsed ? label : ""}
    >
      {icon}
      {!isCollapsed && <span>{label}</span>}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-[#f8f8fa] font-sans overflow-hidden">
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
            <img
              src="https://www.forceusa.com/cdn/shop/t/19/assets/force-usa-logo.svg?v=15702838478117472841757084722"
              alt="Force USA"
              className={`w-auto brightness-0 ${isCollapsed ? 'h-6' : 'h-8'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleSidebar} className="lg:hidden text-gray-500 hover:text-gray-700 p-1">
              <X size={24} />
            </button>
            <button
              onClick={toggleCollapse}
              className={`hidden lg:flex p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ${isCollapsed ? 'absolute -right-3 top-8 bg-white border shadow-sm rounded-full' : ''}`}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {navButton('sales', <BarChart3 size={20} className="shrink-0" />, 'Sales Health')}
          {navButton('opsp', <Target size={20} className="shrink-0" />, 'OPSP')}
          {navButton('initiatives', <Flag size={20} className="shrink-0" />, 'Strategic Priorities')}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
          <img
            src="https://www.forceusa.com/cdn/shop/t/19/assets/force-usa-logo.svg?v=15702838478117472841757084722"
            alt="Force USA"
            className="h-6 w-auto brightness-0"
          />
          <button onClick={toggleSidebar} className="text-gray-600 p-2 rounded-lg hover:bg-gray-100">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1">
          {activeView === 'opsp' ? (
            <OPSPDashboard />
          ) : activeView === 'initiatives' ? (
            <StrategicPrioritiesDashboard />
          ) : (
            <SalesHealthDashboard />
          )}
        </div>
      </div>

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
