
import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { GAF_COLORS, CHART_COLORS } from '../constants';
import { ProcessedTheme } from '../types';

interface ThemeSectionProps {
  title: string;
  data: ProcessedTheme[];
  colorIndex: number;
  loading: boolean;
  onJobClick?: (jobName: string) => void;
}

// Custom Tick Component to handle text wrapping
const CustomYAxisTick = ({ x, y, payload }: any) => {
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-210} y={-25} width={200} height={50}>
        <div style={{
          fontSize: '11px',
          fontFamily: "'Open Sans', sans-serif",
          color: GAF_COLORS.darkGrey,
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: '100%',
          lineHeight: '1.2',
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

const ThemeSection: React.FC<ThemeSectionProps> = ({ title, data, colorIndex, loading, onJobClick }) => {
  // Track expanded top-level themes
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  // Track expanded sub-themes (using composite key: "themeName-subThemeName")
  const [expandedSubThemes, setExpandedSubThemes] = useState<Record<string, boolean>>({});
  // Track current page for each sub-theme
  const [subThemePages, setSubThemePages] = useState<Record<string, number>>({});

  const ITEMS_PER_PAGE = 10;

  if (!data || data.length === 0) {
    return (
      <div
        className="text-center py-8 text-sm"
        style={{ color: GAF_COLORS.darkGrey, fontFamily: "'Open Sans', sans-serif" }}
      >
        {loading ? "Loading..." : `No ${title.toLowerCase()} job data available for this time period`}
      </div>
    );
  }

  const toggleTheme = (themeName: string) => {
    setExpandedThemes((prev) => ({ ...prev, [themeName]: !prev[themeName] }));
  };

  const toggleSubTheme = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubThemes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const changePage = (key: string, newPage: number) => {
    setSubThemePages((prev) => ({ ...prev, [key]: newPage }));
  };

  return (
    <div className="space-y-3">
      {data.map((theme, idx) => {
        const isThemeExpanded = expandedThemes[theme.name];
        const themeColor = CHART_COLORS[(idx + colorIndex) % CHART_COLORS.length];
        
        return (
          <div
            key={theme.name || idx}
            className="border border-white/20 rounded-xl overflow-hidden backdrop-blur-xl bg-white/80 shadow-lg"
          >
            {/* Level 1: Theme Header */}
            <button
              onClick={() => toggleTheme(theme.name)}
              className="w-full px-4 py-3 md:px-5 md:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-left transition-all hover:bg-white/40"
            >
              <div className="flex items-center gap-3 flex-1 w-full">
                <div className="shrink-0" style={{ color: GAF_COLORS.darkGrey }}>
                  {isThemeExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                <div className="flex-1">
                  <div
                    className="font-bold text-sm md:text-base break-words"
                    style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}
                  >
                    {theme.name || "Uncategorized"}
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: GAF_COLORS.darkGrey, fontFamily: "'Open Sans', sans-serif" }}
                  >
                    {theme.count} calls · {theme.percentage}%
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right pl-8 sm:pl-0">
                <div
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: GAF_COLORS.orange, fontFamily: "'Montserrat', sans-serif" }}
                >
                  {theme.count}
                </div>
              </div>
            </button>

            {/* Level 2: Sub-Themes (Middle Layer) */}
            {isThemeExpanded && (
              <div
                className="px-2 md:px-5 py-2 border-t"
                style={{
                  backgroundColor: `${GAF_COLORS.paleGrey}60`,
                  borderColor: `${GAF_COLORS.coolGrey}20`,
                }}
              >
                <div className="space-y-2 mt-2 mb-2">
                  {theme.subThemes.map((sub, sIdx) => {
                    const subKey = `${theme.name}-${sub.name}`;
                    const isSubExpanded = expandedSubThemes[subKey];
                    
                    // Pagination Logic
                    const currentPage = subThemePages[subKey] || 1;
                    const totalPages = Math.ceil(sub.jobs.length / ITEMS_PER_PAGE);
                    const paginatedJobs = sub.jobs.slice(
                      (currentPage - 1) * ITEMS_PER_PAGE,
                      currentPage * ITEMS_PER_PAGE
                    );

                    return (
                      <div 
                        key={subKey} 
                        className="rounded-lg border bg-white/60 overflow-hidden"
                        style={{ borderColor: GAF_COLORS.lightGrey }}
                      >
                         <button
                            onClick={(e) => toggleSubTheme(subKey, e)}
                            className="w-full px-3 py-2 md:px-4 md:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-left hover:bg-white/80 transition-colors"
                          >
                             <div className="flex items-center gap-2 w-full">
                                <div style={{ color: GAF_COLORS.darkGrey }}>
                                  {isSubExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                                <span className="text-xs md:text-sm font-semibold break-words flex-1" style={{ color: GAF_COLORS.black, fontFamily: "'Montserrat', sans-serif" }}>
                                  {sub.name}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 shrink-0" style={{ color: GAF_COLORS.darkGrey }}>
                                  {sub.count}
                                </span>
                             </div>
                             
                             {/* Mini Bar Visual for SubTheme relative to Theme */}
                             <div className="w-full sm:w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden sm:ml-4 mt-1 sm:mt-0">
                                <div 
                                  className="h-full rounded-full" 
                                  style={{ 
                                    width: `${(sub.count / theme.count) * 100}%`,
                                    backgroundColor: themeColor
                                  }}
                                />
                             </div>
                          </button>

                          {/* Level 3: Specific Jobs (Chart) */}
                          {isSubExpanded && (
                            <div className="p-2 md:p-4 bg-white border-t" style={{ borderColor: GAF_COLORS.lightGrey }}>
                               <div className="text-xs font-semibold mb-3 uppercase tracking-wide px-2" style={{ color: GAF_COLORS.darkGrey }}>
                                  Specific Jobs in "{sub.name}" ({sub.jobs.length} total)
                               </div>
                               
                               {paginatedJobs.length > 0 ? (
                                 <ResponsiveContainer width="100%" height={Math.max(150, paginatedJobs.length * 70)}>
                                    <BarChart 
                                      data={paginatedJobs} 
                                      layout="vertical" 
                                      margin={{ left: 0, right: 10, top: 5, bottom: 5 }}
                                    >
                                      <CartesianGrid strokeDasharray="3 3" stroke={`${GAF_COLORS.coolGrey}30`} />
                                      <XAxis
                                        type="number"
                                        stroke={GAF_COLORS.darkGrey}
                                        tick={{ fontSize: 10, fontFamily: "'Open Sans', sans-serif" }}
                                      />
                                      <YAxis
                                        type="category"
                                        dataKey="name"
                                        width={140}
                                        stroke={GAF_COLORS.darkGrey}
                                        tick={<CustomYAxisTick />}
                                        interval={0}
                                      />
                                      <Tooltip
                                        content={({ payload }) => {
                                          if (payload && payload[0]) {
                                            const data = payload[0].payload;
                                            return (
                                              <div
                                                className="p-2.5 rounded-lg border shadow-lg text-xs backdrop-blur-lg"
                                                style={{
                                                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                                                  borderColor: GAF_COLORS.coolGrey + "40",
                                                  fontFamily: "'Open Sans', sans-serif",
                                                  maxWidth: "200px"
                                                }}
                                              >
                                                <div className="font-semibold mb-1 break-words" style={{ color: GAF_COLORS.black }}>
                                                  {data.name}
                                                </div>
                                                <div style={{ color: GAF_COLORS.darkGrey }}>Count: {data.count}</div>
                                                <div style={{ marginTop: '4px', fontStyle: 'italic', color: GAF_COLORS.orange }}>Click to filter dashboard</div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <Bar 
                                        dataKey="count" 
                                        radius={[0, 6, 6, 0]} 
                                        fill={themeColor} 
                                        cursor="pointer"
                                        onClick={(data: any) => {
                                          const jobName = data?.payload?.name || data?.name;
                                          if (onJobClick && jobName) onJobClick(jobName);
                                        }}
                                      />
                                    </BarChart>
                                 </ResponsiveContainer>
                               ) : (
                                 <div className="text-center py-4 text-sm text-gray-500">No jobs to display</div>
                               )}

                               {/* Pagination Controls */}
                               {totalPages > 1 && (
                                 <div className="flex items-center justify-between mt-4 pt-4 border-t px-2" style={{ borderColor: GAF_COLORS.lightGrey }}>
                                   <button
                                     onClick={() => changePage(subKey, Math.max(1, currentPage - 1))}
                                     disabled={currentPage === 1}
                                     className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                     style={{
                                       backgroundColor: currentPage === 1 ? GAF_COLORS.lightGrey : GAF_COLORS.orange,
                                       color: currentPage === 1 ? GAF_COLORS.darkGrey : 'white',
                                     }}
                                   >
                                     <ChevronLeft size={14} /> Prev
                                   </button>
                                   <span className="text-xs font-medium" style={{ color: GAF_COLORS.darkGrey }}>
                                     Page {currentPage} of {totalPages}
                                   </span>
                                   <button
                                     onClick={() => changePage(subKey, Math.min(totalPages, currentPage + 1))}
                                     disabled={currentPage === totalPages}
                                     className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                     style={{
                                       backgroundColor: currentPage === totalPages ? GAF_COLORS.lightGrey : GAF_COLORS.orange,
                                       color: currentPage === totalPages ? GAF_COLORS.darkGrey : 'white',
                                     }}
                                   >
                                     Next <ChevronRight size={14} />
                                   </button>
                                 </div>
                               )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ThemeSection;
