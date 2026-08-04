import React, { useState } from 'react';
import { Activity, Flag, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import GroupHealthDashboard from './GroupHealthDashboard';
import StrategicPrioritiesDashboard from './StrategicPrioritiesDashboard';

type View = 'health' | 'priorities';

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'health', label: 'Group Health', icon: Activity },
  { id: 'priorities', label: 'Strategic Priorities', icon: Flag },
];

const AFS_LOGO = 'https://cdn.shopify.com/s/files/1/1950/1891/files/TheAFSGroup.png?v=1766395105';
const AFS_ICON = '/images/afs-group-icon-orange.png';

const Dashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('health');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen flex bg-brand-offwhite font-sans overflow-hidden">
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
              <img src={AFS_LOGO} alt="The AFS Group" className="h-8 w-auto object-contain" />
            ) : (
              <img src={AFS_ICON} alt="AFS" className="h-8 w-8 object-contain" />
            )}
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
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveView(id); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group ${
                activeView === id
                  ? 'bg-[#fdece5] text-[#F26422] shadow-sm border border-[#fbd9ca]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? label : ''}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto relative">
        {/* Mobile Header Trigger */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
          <img src={AFS_LOGO} alt="The AFS Group" className="h-6 w-auto object-contain" />
          <button onClick={toggleSidebar} className="text-gray-600 p-2 rounded-lg hover:bg-gray-100">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1">
          {activeView === 'priorities' ? <StrategicPrioritiesDashboard /> : <GroupHealthDashboard />}
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
