// src/components/KpiCard.tsx
import { useEffect, useRef, useState } from "react";
import { Delta } from "./Delta";
import { SourceLink } from "./SourceLink";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number | null;
  /** Set true for lower-is-better metrics (CPC, CPM, CPA) — inverts delta colour logic */
  invertDelta?: boolean;
  subLabel?: string;
  /** Source/calculation note — hover on desktop, tap the ⓘ on touch devices */
  tooltip?: string;
  /** Clickable source-document links, rendered top-right of the card */
  sources?: { href: string; title: string }[];
}

export function KpiCard({ label, value, delta, invertDelta, subLabel, tooltip, sources }: KpiCardProps) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Tap-anywhere-else (or Escape) dismisses the popover — native title
  // tooltips never fire on touch devices, hence this component.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={cardRef}
      className="dash-card relative flex flex-col gap-1 min-w-0 p-3 sm:p-5"
      style={{ zIndex: open ? 40 : undefined }}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Source-document links (top-right) */}
      {sources && sources.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1">
          {sources.map((s) => (
            <SourceLink key={s.href + s.title} href={s.href} title={s.title} />
          ))}
        </div>
      )}

      {/* LABEL — ⓘ marks a tooltip; hover or tap to open */}
      <span
        className="text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate"
        style={{
          color: "var(--gaf-text-muted)",
          cursor: tooltip ? "help" : undefined,
        }}
        onMouseEnter={tooltip ? () => setOpen(true) : undefined}
        onClick={tooltip ? (e) => { e.stopPropagation(); setOpen(o => !o); } : undefined}
        role={tooltip ? "button" : undefined}
        aria-expanded={tooltip ? open : undefined}
        aria-label={tooltip ? `${label} — tap for definition` : undefined}
      >
        {label}
        {tooltip && (
          <span aria-hidden="true" className="ml-1 opacity-60">&#9432;</span>
        )}
      </span>

      {/* Tooltip popover — dark pill, matches chart tooltips */}
      {tooltip && open && (
        <div
          className="absolute left-2 right-2 top-8 z-30 rounded-lg px-3 py-2 text-[11px] leading-relaxed shadow-lg"
          style={{ background: "#1f2937", color: "#f9fafb" }}
          role="tooltip"
        >
          {tooltip}
        </div>
      )}

      {/* KPI NUMBER + DELTA — wraps rather than clipping on narrow cards */}
      <div className="flex items-baseline justify-between gap-x-2 gap-y-0.5 mt-0.5 flex-wrap">
        <span
          className="text-lg sm:text-2xl font-bold font-display leading-tight tabular-nums"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          {value}
        </span>
        {delta !== undefined && delta !== null && (
          <Delta pct={delta} invert={invertDelta} />
        )}
      </div>

      {/* Optional sub-label */}
      {subLabel && (
        <span
          className="text-[10px] mt-0.5"
          style={{ color: "var(--gaf-text-muted)" }}
        >
          {subLabel}
        </span>
      )}
    </div>
  );
}
