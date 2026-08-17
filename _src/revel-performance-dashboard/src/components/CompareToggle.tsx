// src/components/CompareToggle.tsx
import { useCompare } from "../state/CompareContext";
import { useDateRange } from "../state/DateRangeContext";

const WINDOW_LABELS: Record<string, string> = {
  yesterday: "the day before",
  "7d": "the previous 7 days",
  "30d": "the previous 30 days",
  "90d": "the previous 90 days",
  lastMonth: "the month before",
  mtd: "the same days last month",
};

export function CompareToggle() {
  const { compare, setCompare } = useCompare();
  const { window } = useDateRange();
  const against = WINDOW_LABELS[window] ?? "the previous period";

  return (
    <label
      className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold"
      style={{ color: compare ? "var(--gaf-primary)" : "var(--gaf-text-muted)" }}
      title={`Show movement against ${against}`}
    >
      <input
        type="checkbox"
        checked={compare}
        onChange={(e) => setCompare(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="relative inline-block rounded-full transition-colors duration-150"
        style={{
          width: 30,
          height: 17,
          background: compare ? "var(--gaf-primary)" : "#d1d5db",
        }}
      >
        <span
          className="absolute rounded-full bg-white transition-transform duration-150"
          style={{
            width: 13,
            height: 13,
            top: 2,
            left: 2,
            transform: compare ? "translateX(13px)" : "none",
          }}
        />
      </span>
      Compare to previous period
    </label>
  );
}
