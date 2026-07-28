import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GAF_COLORS } from '../constants';

const FilterStats: React.FC<{ data: any[] }> = ({ data }) => {
  const analyzed = data.filter((r) => r.should_analyze === "TRUE" || r.should_analyze === true).length;
  const filtered = data.length - analyzed;
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
      className="rounded-2xl border border-white/20 backdrop-blur-xl bg-white/80 p-4 md:p-5 shadow-lg"
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      <h3
        className="text-base font-bold mb-2"
        style={{ fontFamily: "'Montserrat', sans-serif", color: GAF_COLORS.black }}
      >
        AI Filter Effectiveness
      </h3>
      <p className="text-xs mb-4" style={{ color: GAF_COLORS.darkGrey }}>
        Two-tier filtering saves analysis costs by removing voicemails, service calls, and non-valuable conversations
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: `1px solid ${GAF_COLORS.coolGrey}40`,
                  borderRadius: "8px",
                  fontFamily: "'Open Sans', sans-serif",
                }}
              />
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                <Cell fill={GAF_COLORS.orange} />
                <Cell fill={GAF_COLORS.darkGrey} />
              </Pie>
              <Legend wrapperStyle={{ fontFamily: "'Open Sans', sans-serif" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <div
              className="text-2xl font-bold"
              style={{ color: GAF_COLORS.orange, fontFamily: "'Montserrat', sans-serif" }}
            >
              {((filtered / data.length) * 100).toFixed(1)}%
            </div>
            <div className="text-xs" style={{ color: GAF_COLORS.darkGrey }}>
              Filtered out
            </div>
          </div>
        </div>

        {/* Filter Reasons */}
        <div>
          <h4
            className="text-xs font-semibold mb-2"
            style={{ color: GAF_COLORS.darkGrey, fontFamily: "'Montserrat', sans-serif" }}
          >
            Filter Breakdown
          </h4>
          <div className="space-y-2">
            {reasonsData.slice(0, 5).map((reason) => (
              <div key={reason.name} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1" style={{ color: GAF_COLORS.black }}>
                  {reason.name}
                </span>
                <span
                  className="font-semibold ml-2"
                  style={{ color: GAF_COLORS.orange, fontFamily: "'Montserrat', sans-serif" }}
                >
                  {reason.count}
                </span>
              </div>
            ))}
            {reasonsData.length > 5 && (
              <div className="text-xs italic" style={{ color: GAF_COLORS.darkGrey }}>
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