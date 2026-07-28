
import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GAF_COLORS } from '../constants';

const FilterStats: React.FC<{ data: any[] }> = ({ data }) => {
  const analyzed = data.filter((r) => r.should_analyze === "TRUE" || r.should_analyze === true).length;
  const filtered = data.length - analyzed;
  const total = data.length;
  const filteredPct = total > 0 ? ((filtered / total) * 100).toFixed(1) : "0";
  
  const filterReasons: Record<string, number> = {};

  data.forEach((row) => {
    if (row.should_analyze === "FALSE" || row.should_analyze === false) {
      const reason = row.filter_reason || "unknown";
      filterReasons[reason] = (filterReasons[reason] || 0) + 1;
    }
  });

  const reasonsData = Object.entries(filterReasons)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const pieData = [
    { name: "Analyzed", value: analyzed },
    { name: "Filtered", value: filtered },
  ];

  return (
    <div
      className="rounded-2xl border border-white/20 backdrop-blur-xl bg-white/80 p-6 shadow-lg flex flex-col"
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      <div className="mb-4">
        <h3
          className="text-sm md:text-base font-bold mb-1"
          style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}
        >
          AI Filter Effectiveness
        </h3>
        <p className="text-xs leading-relaxed text-gray-500">
          Two-tier filtering saves analysis costs by removing voicemails, service calls, and non-valuable conversations
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 flex-1">
        
        {/* Left: Chart & Stats */}
        <div className="w-full md:w-auto flex flex-col items-center justify-center shrink-0">
            <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: `1px solid ${GAF_COLORS.coolGrey}40`,
                          borderRadius: "8px",
                          fontSize: "12px",
                          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                        }}
                      />
                      <Pie 
                        data={pieData} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={68} 
                        outerRadius={84} 
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={0}
                        stroke="none"
                      >
                        <Cell fill={GAF_COLORS.orange} />
                        <Cell fill={GAF_COLORS.darkGrey} />
                      </Pie>
                    </PieChart>
                </ResponsiveContainer>
                
                {/* Stats inside donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-3xl font-extrabold tracking-tight leading-none" style={{ color: GAF_COLORS.orange, fontFamily: "'Montserrat', sans-serif" }}>
                        {filteredPct}%
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mt-1">Filtered</div>
                </div>
            </div>

            <div className="flex items-center gap-5 mt-2">
                 <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GAF_COLORS.orange }}></span> Analyzed
                 </div>
                 <div className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: GAF_COLORS.darkGrey }}></span> Filtered
                 </div>
            </div>
        </div>

        {/* Right: List */}
        <div className="w-full md:flex-1 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-8">
            <h4
              className="text-[10px] font-bold mb-4 uppercase tracking-wide text-gray-500"
              style={{ fontFamily: "'Montserrat', sans-serif" }}
            >
              Filter Breakdown
            </h4>
            <div className="space-y-3">
              {reasonsData.slice(0, 5).map((reason) => (
                <div key={reason.name} className="flex items-center justify-between text-xs group">
                  <span className="truncate flex-1 pr-4 text-gray-600 font-medium group-hover:text-gray-900 transition-colors" title={reason.name}>
                    {reason.name}
                  </span>
                  
                  <div className="flex items-center gap-3">
                     <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                        <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ 
                                width: `${(reason.count / filtered) * 100}%`,
                                backgroundColor: GAF_COLORS.darkGrey 
                            }}
                        />
                     </div>
                     <span
                        className="font-bold w-8 text-right"
                        style={{ color: GAF_COLORS.orange, fontFamily: "'Montserrat', sans-serif" }}
                      >
                        {reason.count}
                      </span>
                  </div>
                </div>
              ))}
              {reasonsData.length > 5 && (
                <div className="text-[10px] italic text-right pt-2 text-gray-400">
                  +{reasonsData.length - 5} more reasons
                </div>
              )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default FilterStats;
