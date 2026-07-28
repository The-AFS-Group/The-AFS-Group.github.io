// src/components/TrendChart.tsx
// Hand-rolled SVG line chart matching the GAF design system spec.
// Replaces the Recharts implementation to match the reference dashboard's
// SVG-native approach: primary orange line + area fill, #f0f0f2 grid, dark pill tooltip.

import { useState } from "react";

const PRIMARY = "var(--gaf-primary)";    // #f26422
const GRID_COLOR = "#f0f0f2";
const AXIS_COLOR = "#9ca3af";
const TOOLTIP_BG = "#1f2937";

const PAD = { top: 20, right: 20, bottom: 32, left: 52 };
const VIEW_W = 800;
const VIEW_H = 220;

// Fallback formatter when the series doesn't provide one. Series keys are
// lowercase feed fields, so match case-insensitively — and NEVER assume a
// bare number is currency (the audit found "$8.7K sessions").
function defaultFmt(v: number, key: string): string {
  const k = key.toLowerCase();
  if (k.includes("roas")) return `${v.toFixed(2)}x`;
  if (k.includes("ctr") || k.includes("rate")) return `${v.toFixed(1)}%`;
  const isCurrency = k.includes("spend") || k.includes("value") || k.includes("revenue") || k.includes("cp");
  const prefix = isCurrency ? "$" : "";
  if (Math.abs(v) >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${prefix}${(v / 1_000).toFixed(1)}K`;
  if (v < 10 && v !== Math.round(v)) return `${prefix}${v.toFixed(2)}`;
  return `${prefix}${v.toLocaleString("en-AU")}`;
}

/** ISO "2026-07-10" → "07-10" for axis labels; leaves other formats alone. */
function fmtDateLabel(d: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(5) : d;
}

interface AreaSeries {
  key: string;
  color: string;
  label: string;
  /** Value formatter for axis/stats/tooltip (falls back to a key-based heuristic) */
  format?: (v: number) => string;
}

interface LineSeries {
  key: string;
  color: string;
  label: string;
}

interface TrendChartSeries {
  areas: AreaSeries[];
  line?: LineSeries;
}

interface TrendChartProps {
  data: Array<{ date: string; [key: string]: number | string }>;
  series: TrendChartSeries;
}

export function TrendChart({ data, series }: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm" style={{ color: AXIS_COLOR }}>
        No data in this window.
      </div>
    );
  }

  // Use primary series key for the main line/area
  const primary = series.areas[0];
  const primaryKey = primary?.key ?? series.line?.key;

  if (!primaryKey) return null;

  const fmt = (v: number) =>
    primary?.format ? primary.format(v) : defaultFmt(v, primaryKey);

  const values = data.map(d => (d[primaryKey] as number) ?? 0);
  const maxVal = Math.max(...values, 0.001);
  const minVal = Math.min(...values, 0);

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;

  function xOf(i: number) {
    return PAD.left + (i / (data.length - 1 || 1)) * innerW;
  }
  function yOf(v: number) {
    const range = maxVal - minVal || 1;
    return PAD.top + innerH - ((v - minVal) / range) * innerH;
  }

  const points = data.map((d, i) => ({ x: xOf(i), y: yOf((d[primaryKey] as number) ?? 0) }));

  // Build SVG path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = linePath
    + ` L${points[points.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)}`
    + ` L${PAD.left},${(PAD.top + innerH).toFixed(1)} Z`;

  // Average reference line
  const avg = values.reduce((s, v) => s + v, 0) / (values.length || 1);
  const avgY = yOf(avg);

  // Y-axis ticks (5 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = minVal + f * (maxVal - minVal);
    return { y: yOf(v), label: fmt(v) };
  });

  // X-axis ticks (up to 8 evenly spaced)
  const xTickCount = Math.min(data.length, 8);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1 || 1)) * (data.length - 1));
    return { x: xOf(idx), label: fmtDateLabel(String(data[idx]?.date ?? "")) };
  });

  // Hover tooltip
  const hoverPt = hoverIdx !== null ? points[hoverIdx] : null;
  const hoverD = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="w-full">
      {/* Stats row */}
      <div className="flex items-center gap-6 mb-3 px-1">
        {[
          { label: "Avg", val: avg },
          { label: "Peak", val: Math.max(...values) },
          { label: "Low", val: Math.min(...values) },
        ].map(stat => (
          <div key={stat.label} className="flex items-baseline gap-1.5">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: AXIS_COLOR }}
            >
              {stat.label}
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              {fmt(stat.val)}
            </span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full"
        style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={tick.y}
            x2={PAD.left + innerW}
            y2={tick.y}
            stroke={GRID_COLOR}
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={PAD.left - 6}
            y={tick.y + 3}
            textAnchor="end"
            fontSize={9}
            fill={AXIS_COLOR}
          >
            {tick.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={i}
            x={tick.x}
            y={PAD.top + innerH + 16}
            textAnchor="middle"
            fontSize={9}
            fill={AXIS_COLOR}
          >
            {tick.label}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={PRIMARY} fillOpacity={0.07} />

        {/* Avg dashed reference line */}
        <line
          x1={PAD.left}
          y1={avgY}
          x2={PAD.left + innerW}
          y2={avgY}
          stroke={PRIMARY}
          strokeWidth={1}
          strokeDasharray="6 4"
          strokeOpacity={0.4}
        />

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke={PRIMARY}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover interaction overlay */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={i === 0 ? PAD.left : (p.x + points[i - 1].x) / 2}
            y={PAD.top}
            width={i === 0
              ? (points[1]?.x ?? p.x + innerW / data.length) / 2 - PAD.left
              : (i === data.length - 1
                  ? p.x + innerW / data.length
                  : (p.x + (points[i + 1]?.x ?? p.x)) / 2) - (p.x + points[i - 1].x) / 2}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
          />
        ))}

        {/* Hover crosshair + dot */}
        {hoverPt !== null && (
          <>
            <line
              x1={hoverPt.x}
              y1={PAD.top}
              x2={hoverPt.x}
              y2={PAD.top + innerH}
              stroke={PRIMARY}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
            <circle cx={hoverPt.x} cy={hoverPt.y} r={5} fill={PRIMARY} />
            <circle cx={hoverPt.x} cy={hoverPt.y} r={3} fill="white" />
          </>
        )}

        {/* Data point dots (r=3 white outline) */}
        {data.length <= 30 && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3}
            fill={hoverIdx === i ? PRIMARY : "white"}
            stroke={PRIMARY}
            strokeWidth={1.5}
          />
        ))}

        {/* Hover tooltip (dark pill) */}
        {hoverPt !== null && hoverD !== null && (() => {
          const tv = (hoverD[primaryKey] as number) ?? 0;
          const dateLabel = String(hoverD.date ?? "");
          const valLabel = fmt(tv);
          const tooltipX = hoverPt.x + 12;
          const tooltipY = Math.max(PAD.top, hoverPt.y - 28);
          const clampedX = Math.min(tooltipX, VIEW_W - 100);
          return (
            <g>
              <rect
                x={clampedX - 6}
                y={tooltipY - 16}
                width={96}
                height={38}
                rx={7}
                fill={TOOLTIP_BG}
                fillOpacity={0.95}
              />
              <text
                x={clampedX + 42}
                y={tooltipY}
                textAnchor="middle"
                fontSize={9}
                fill="#9ca3af"
              >
                {dateLabel}
              </text>
              <text
                x={clampedX + 42}
                y={tooltipY + 14}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="white"
              >
                {valLabel}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
