// src/components/AustraliaMap.tsx
import { useState } from "react";
import { AU_STATES } from "../assets/au-states";

interface GeoEntry {
  region: string;
  sessions: number;
}

interface AustraliaMapProps {
  geo: GeoEntry[];
}

/**
 * GAF brand-orange choropleth ramp (#f26422 ≈ hsl(21, 89%, 54%)).
 * share 0 → pale tint, share 1 → deep brand orange. Light-theme page.
 */
function sessionColour(share: number): string {
  const l = Math.round(94 - share * 44);   // 94% (near-white tint) → 50% (deep orange)
  const s = Math.round(60 + share * 30);   // 60% → 90%
  return `hsl(21,${s}%,${l}%)`;
}

/** Label colour flips to white once the fill gets dark enough to need it. */
function labelColour(share: number): string {
  return share > 0.45 ? "#ffffff" : "#374151";
}

export function AustraliaMap({ geo }: AustraliaMapProps) {
  const [tooltip, setTooltip] = useState<{ region: string; sessions: number; x: number; y: number } | null>(null);

  // Build lookup: region name -> sessions
  const sessionMap: Record<string, number> = {};
  let totalSessions = 0;
  for (const entry of geo) {
    sessionMap[entry.region] = (sessionMap[entry.region] ?? 0) + entry.sessions;
    totalSessions += entry.sessions;
  }
  const maxSessions = Math.max(...Object.values(sessionMap), 1);

  if (geo.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No geographic data available.
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-lg mx-auto select-none">
      <svg
        viewBox="0 0 500 500"
        className="w-full h-auto"
        aria-label="Australia sessions choropleth map"
        role="img"
      >
        {Object.entries(AU_STATES).map(([regionName, shape]) => {
          const sessions = sessionMap[regionName] ?? 0;
          // Normalise against the BUSIEST state so the ramp uses its full
          // range (share-of-total left every state pale).
          const share = sessions / maxSessions;
          const fill = sessionColour(share);

          return (
            <g key={regionName}>
              <path
                d={shape.d}
                fill={fill}
                stroke="#ffffff"
                strokeWidth={2}
                style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect();
                  setTooltip({
                    region: regionName,
                    sessions,
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                  });
                }}
                onMouseMove={(e) => {
                  const rect = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect();
                  setTooltip((prev) =>
                    prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
                  );
                }}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={shape.cx}
                y={shape.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="var(--font-body), sans-serif"
                fontWeight={600}
                fill={labelColour(share)}
                pointerEvents="none"
              >
                {shape.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip — dark pill, matches chart tooltips */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 rounded-md px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: tooltip.x + 8, top: tooltip.y - 32, background: "#1f2937", color: "#fff" }}
        >
          <span className="font-semibold">{tooltip.region}</span>
          {" — "}
          {tooltip.sessions.toLocaleString("en-AU")} sessions
        </div>
      )}

      {/* Colour scale legend */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs" style={{ color: "var(--gaf-text-muted)" }}>
        <span>Fewer sessions</span>
        <div
          className="h-2 w-24 rounded"
          style={{
            background: "linear-gradient(to right, hsl(21,60%,94%), hsl(21,90%,50%))",
          }}
        />
        <span>More sessions</span>
      </div>
    </div>
  );
}
