// src/tabs/Experiments.tsx
// GAF Experimentation Engine — live snapshot of the Asana board
// (1215988556469556): sprint pipeline, wins/losses, ICE, per-experiment links.
import { useMemo, useState } from "react";
import { KpiCard } from "../components/KpiCard";
import { fmtInt } from "../lib/format";
import type { PerfData, ExperimentRow } from "../lib/data";

interface Props {
  data: PerfData;
}

const SECTION_ORDER = ["This Sprint", "Running", "Analysing", "Learnings", "Backlog"];

const SECTION_STYLE: Record<string, { color: string; bg: string }> = {
  "Backlog":     { color: "#6b7280", bg: "#f3f4f6" },
  "This Sprint": { color: "#2563eb", bg: "#eff6ff" },
  "Running":     { color: "var(--gaf-primary)", bg: "var(--gaf-primary-light)" },
  "Analysing":   { color: "#d97706", bg: "#fffbeb" },
  "Learnings":   { color: "#059669", bg: "#ecfdf5" },
};

const WINLOSS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Win:          { color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  Loss:         { color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  Inconclusive: { color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

function SectionPill({ section }: { section?: string }) {
  const s = SECTION_STYLE[String(section ?? "")] ?? { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
      {section || "—"}
    </span>
  );
}

function WinLossBadge({ value }: { value?: string }) {
  if (!value) return <span style={{ color: "var(--gaf-text-muted)" }}>–</span>;
  const s = WINLOSS_STYLE[value] ?? WINLOSS_STYLE.Inconclusive;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {value}
    </span>
  );
}

export function Experiments({ data }: Props) {
  const exp = data.experiments;
  const experiments = useMemo(() => exp?.experiments ?? [], [exp]);
  const summary = exp?.summary ?? {};

  // Default to Active, but fall back to All while nothing is committed to a
  // sprint yet — an empty default view helps nobody.
  const hasActive =
    (summary.thisSprint ?? 0) + (summary.running ?? 0) + (summary.analysing ?? 0) > 0;
  const [sectionFilter, setSectionFilter] = useState<string>(hasActive ? "Active" : "All");

  const filtered = useMemo(() => {
    let rows: ExperimentRow[] = [...experiments];
    if (sectionFilter === "Active") {
      rows = rows.filter(e => ["This Sprint", "Running", "Analysing"].includes(String(e.section)));
    } else if (sectionFilter !== "All") {
      rows = rows.filter(e => String(e.section) === sectionFilter);
    }
    // Active pipeline first (sprint order), then ICE descending inside a section
    const order = (s?: string) => {
      const i = SECTION_ORDER.indexOf(String(s));
      return i === -1 ? 99 : i;
    };
    rows.sort((a, b) => order(a.section) - order(b.section) || Number(b.ice ?? 0) - Number(a.ice ?? 0));
    return rows;
  }, [experiments, sectionFilter]);

  if (!exp || experiments.length === 0) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No experimentation board data available.
      </div>
    );
  }

  const maxSection = Math.max(...(exp.sections ?? []).map(s => s.count), 1);

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Experimentation Engine
        </h3>
        <a
          href="https://app.asana.com/0/1215988556469556/board"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
          style={{ color: "var(--gaf-primary)" }}
        >
          Open board in Asana
        </a>
      </div>

      {/* Summary KPIs */}
      <section aria-label="Experiment programme summary">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 stagger">
          <KpiCard
            label="Active Experiments"
            value={fmtInt((summary.thisSprint ?? 0) + (summary.running ?? 0) + (summary.analysing ?? 0))}
            tooltip="This Sprint + Running + Analysing."
          />
          <KpiCard label="This Sprint" value={fmtInt(summary.thisSprint ?? 0)} tooltip="Committed for the current sprint." />
          <KpiCard label="Wins" value={fmtInt(summary.wins ?? 0)} tooltip="Experiments concluded as wins (Win/Loss field)." />
          <KpiCard label="Losses" value={fmtInt(summary.losses ?? 0)} tooltip="Experiments concluded as losses. A loss with a learning still moves the system forward." />
          <KpiCard
            label="Win Rate"
            value={summary.winRatePct != null ? `${summary.winRatePct.toFixed(0)}%` : "–"}
            tooltip="Wins ÷ decided experiments (wins + losses)."
          />
          <KpiCard label="Shipped (30d)" value={fmtInt(summary.completedLast30d ?? 0)} tooltip="Experiments completed in the last 30 days." />
        </div>
      </section>

      {/* Pipeline by section */}
      <section className="dash-card p-5" aria-label="Pipeline by board section">
        <h4 className="text-sm font-bold mb-3" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
          Pipeline
        </h4>
        <div className="space-y-2.5">
          {SECTION_ORDER.map(name => {
            const count = (exp.sections ?? []).find(s => s.name === name)?.count ?? 0;
            const style = SECTION_STYLE[name];
            return (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs font-semibold w-24 shrink-0" style={{ color: style.color }}>{name}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(count / maxSection) * 100}%`, background: style.color }} />
                </div>
                <span className="text-xs tabular-nums w-8 text-right" style={{ color: "var(--gaf-text-secondary)" }}>{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Experiments list */}
      <section aria-label="Experiments">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h4 className="text-sm font-bold" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
            Experiments
          </h4>
          <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-gray-100">
            {["Active", "Learnings", "Backlog", "All"].map(f => {
              const isActive = sectionFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setSectionFilter(f)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                  style={{
                    background: isActive ? "#fff" : "transparent",
                    color: isActive ? "#111827" : "var(--gaf-text-muted)",
                    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <div className="dash-card overflow-hidden" style={{ padding: 0 }}>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse" style={{ fontFamily: "var(--font-body)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  {["Experiment", "Stage", "Owner", "Channel", "ICE", "Result"].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2.5 px-3 text-[11px] uppercase tracking-wide font-semibold whitespace-nowrap ${i >= 4 ? "text-right" : "text-left"}`}
                      style={{ color: "var(--gaf-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={e.gid ?? i}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--gaf-row-border)" }}
                    onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td className="py-2.5 px-3 text-sm max-w-[420px]">
                      <a
                        href={e.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline block truncate"
                        style={{ color: "#111827" }}
                        title={String(e.name ?? "")}
                      >
                        {String(e.name ?? "")}
                      </a>
                      {e.funnelStage && (
                        <span className="text-[11px]" style={{ color: "var(--gaf-text-muted)" }}>{e.funnelStage}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3"><SectionPill section={e.section} /></td>
                    <td className="py-2.5 px-3 text-sm" style={{ color: "var(--gaf-text-secondary)" }}>{e.owner || "–"}</td>
                    <td className="py-2.5 px-3 text-sm" style={{ color: "var(--gaf-text-secondary)" }}>{e.channel || "–"}</td>
                    <td className="py-2.5 px-3 text-sm text-right tabular-nums font-semibold" style={{ color: "var(--gaf-text-primary)" }}>
                      {e.ice != null ? e.ice.toFixed(1) : "–"}
                    </td>
                    <td className="py-2.5 px-3 text-right"><WinLossBadge value={e.winLoss} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
                      No experiments in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--gaf-text-muted)" }}>
          Live from the GAF Experimentation Engine Asana board (refreshed with the nightly snapshot). Click an experiment to open its card.
        </p>
      </section>
    </div>
  );
}
