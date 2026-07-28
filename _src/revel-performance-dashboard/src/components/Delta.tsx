// src/components/Delta.tsx
import { fmtDelta } from "../lib/format";

interface DeltaProps {
  pct: number | null | undefined;
  /** Invert colour logic for lower-is-better metrics (CPC, CPM, CPA) */
  invert?: boolean;
}

export function Delta({ pct, invert }: DeltaProps) {
  const { text, dir } = fmtDelta(pct);

  // The ARROW always shows the actual direction of movement; only the
  // COLOUR flips for lower-is-better metrics (a falling CPA is ▼ in green).
  const isGood = dir !== "flat" && (invert ? dir === "down" : dir === "up");

  const baseClass = "text-[10px] sm:text-xs font-semibold flex items-center gap-0.5 whitespace-nowrap";

  if (dir === "flat") {
    return (
      <span className={baseClass} style={{ color: "var(--gaf-delta-flat)" }}>{text}</span>
    );
  }

  return (
    <span
      className={baseClass}
      style={{ color: isGood ? "var(--gaf-delta-pos)" : "var(--gaf-delta-neg)" }}
    >
      <span aria-hidden="true">{dir === "up" ? "▲" : "▼"}</span>
      {text}
    </span>
  );
}
