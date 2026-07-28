// src/components/DonutChart.tsx
// Hand-built SVG donut (no charting library — matches TrendChart house style).
// Renders concentric stroke-dash segments + a center total and a value/pct legend.
import { useState } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Formats slice + center values (e.g. fmtCurrency) */
  format: (n: number) => string;
  centerLabel?: string;
  /** Diameter in px of the SVG box (default 200) */
  size?: number;
}

const RADIUS = 70;
const STROKE = 26;
const CIRC = 2 * Math.PI * RADIUS;

export function DonutChart({ slices, format, centerLabel, size = 200 }: DonutChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{ height: size, color: "var(--gaf-text-muted)" }}
      >
        No expenses in this window.
      </div>
    );
  }

  // Accumulate dash offsets around the ring (start at 12 o'clock via -90° rotation).
  let acc = 0;
  const segments = positive.map((s, i) => {
    const frac = s.value / total;
    const dash = frac * CIRC;
    const seg = { ...s, i, frac, dash, offset: -acc };
    acc += dash;
    return seg;
  });

  const activeIdx = hover;
  const active = activeIdx != null ? segments[activeIdx] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          role="img"
          aria-label="Expense breakdown by category"
        >
          <g transform="rotate(-90 100 100)">
            {segments.map((seg) => (
              <circle
                key={seg.label}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={hover === seg.i ? STROKE + 4 : STROKE}
                strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                strokeDashoffset={seg.offset}
                style={{ transition: "stroke-width .12s ease", cursor: "default" }}
                opacity={hover != null && hover !== seg.i ? 0.4 : 1}
                onMouseEnter={() => setHover(seg.i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
        {/* Center label — total, or the hovered slice */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <span
            className="text-lg font-bold font-display tabular-nums leading-tight"
            style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
          >
            {active ? format(active.value) : format(total)}
          </span>
          <span className="text-[10px] uppercase tracking-wider mt-0.5 truncate max-w-full" style={{ color: "var(--gaf-text-muted)" }}>
            {active ? active.label : centerLabel ?? "Total"}
          </span>
        </div>
      </div>

      {/* Legend */}
      <ul className="flex-1 w-full space-y-1.5 min-w-0">
        {segments.map((seg) => (
          <li
            key={seg.label}
            className="flex items-center gap-2 text-sm rounded-md px-1.5 py-1 transition-colors"
            style={{ background: hover === seg.i ? "var(--gaf-primary-light)" : "transparent" }}
            onMouseEnter={() => setHover(seg.i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
            <span className="truncate flex-1" style={{ color: "var(--gaf-text-secondary)" }}>
              {seg.label}
            </span>
            <span className="tabular-nums font-semibold shrink-0" style={{ color: "var(--gaf-text-primary)" }}>
              {format(seg.value)}
            </span>
            <span className="tabular-nums text-xs shrink-0 w-11 text-right" style={{ color: "var(--gaf-text-muted)" }}>
              {(seg.frac * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
