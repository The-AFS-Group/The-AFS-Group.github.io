// src/tabs/meta/MetaDecisionPanels.tsx
import { fmtCurrency, fmtInt, fmtPct, fmtRoas } from "../../lib/format";
import type { MetaEntityRow } from "../../lib/data";

// ---- Objective/Tier logic (matches meta-ads-dashboard.html) ----

const OBJECTIVE_MAP: Record<string, string> = {
  OUTCOME_SALES: 'conversion', CONVERSIONS: 'conversion', CATALOG_SALES: 'conversion',
  PRODUCT_CATALOG_SALES: 'conversion',
  OUTCOME_TRAFFIC: 'traffic', LINK_CLICKS: 'traffic',
  OUTCOME_AWARENESS: 'awareness', REACH: 'awareness', BRAND_AWARENESS: 'awareness',
  OUTCOME_ENGAGEMENT: 'engagement', POST_ENGAGEMENT: 'engagement', VIDEO_VIEWS: 'engagement',
  OUTCOME_LEADS: 'leads', LEAD_GENERATION: 'leads',
};

type Tier = 'win' | 'watch' | 'waste';

const TIER_TOOLTIPS: Record<Tier, string> = {
  win: "Performing above the campaign median for its objective. Strong candidate for scaling.",
  watch: "Near median performance or low spend. Monitor before making changes.",
  waste: "Performing well below the campaign median for its objective. Consider pausing or reallocating budget.",
};

/**
 * Median of the positive values in a list (zeros excluded), matching the
 * reference dashboard's benchmark. The mean — especially with zeros included —
 * lets one 30x ROAS outlier drag every normal campaign into "waste".
 */
export function medianPositive(values: number[]): number {
  const positives = values.filter(v => v > 0).sort((a, b) => a - b);
  if (!positives.length) return 0;
  const mid = Math.floor(positives.length / 2);
  return positives.length % 2
    ? positives[mid]
    : (positives[mid - 1] + positives[mid]) / 2;
}

interface Benchmarks {
  roas: number;
  ctr: number;
  cpm: number;
}

export function campaignBenchmarks(campaigns: MetaEntityRow[]): Benchmarks {
  return {
    roas: medianPositive(campaigns.map(c => Number(c.roas ?? 0))),
    ctr: medianPositive(campaigns.map(c => Number(c.ctr ?? 0))),
    cpm: medianPositive(campaigns.map(c => Number(c.cpm ?? 0))),
  };
}

interface CampaignClassification {
  tier: Tier;
  metric: string;
  val: number;
  lowerBetter: boolean;
}

export function classifyCampaign(c: MetaEntityRow, bench: Benchmarks): CampaignClassification {
  const goal = OBJECTIVE_MAP[c.objective ?? ''] ?? null;
  let metric = 'CTR';
  let val = 0;
  let avg = 0;
  let lowerBetter = false;

  if (goal === 'conversion' || goal === 'leads') {
    metric = 'ROAS'; val = Number(c.roas ?? 0); avg = bench.roas;
  } else if (goal === 'traffic' || goal === 'engagement') {
    metric = 'CTR'; val = Number(c.ctr ?? 0); avg = bench.ctr;
  } else if (goal === 'awareness') {
    metric = 'CPM'; val = Number(c.cpm ?? 0); avg = bench.cpm; lowerBetter = true;
  } else if (Number(c.conversions ?? 0) > 0) {
    metric = 'ROAS'; val = Number(c.roas ?? 0); avg = bench.roas;
  } else {
    metric = 'CTR'; val = Number(c.ctr ?? 0); avg = bench.ctr;
  }

  let tier: Tier = 'watch';
  const spend = Number(c.spend ?? 0);
  if (spend < 50) {
    tier = 'watch';
  } else if (lowerBetter) {
    if (val <= avg * 0.6) tier = 'win';
    else if (val <= avg * 1.5) tier = 'watch';
    else tier = 'waste';
  } else {
    if (val >= avg * 1.0) tier = 'win';
    else if (val >= avg * 0.5) tier = 'watch';
    else tier = 'waste';
  }

  return { tier, metric, val, lowerBetter };
}

const TIER_STYLE: Record<Tier, { label: string; color: string; bg: string; border: string }> = {
  win:   { label: "Win",   color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  watch: { label: "Watch", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  waste: { label: "Waste", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

function TierBadge({ tier, metric, val }: { tier: Tier; metric: string; val: number }) {
  const s = TIER_STYLE[tier];
  const valText = metric === 'ROAS' ? fmtRoas(val) : metric === 'CPM' ? fmtCurrency(val) : fmtPct(val);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}`, cursor: "help" }}
      title={TIER_TOOLTIPS[tier]}
    >
      {s.label} ({valText})
    </span>
  );
}

// ---- CampaignTierPanel — per-campaign list, reference-style ----

export function CampaignTierPanel({ campaigns }: { campaigns: MetaEntityRow[] }) {
  if (!campaigns.length) return null;

  const bench = campaignBenchmarks(campaigns);
  const classified = campaigns
    .map(c => ({ campaign: c, cl: classifyCampaign(c, bench) }))
    .sort((a, b) => Number(b.campaign.spend ?? 0) - Number(a.campaign.spend ?? 0));

  const maxSpend = Math.max(...classified.map(x => Number(x.campaign.spend ?? 0)), 1);
  const counts: Record<Tier, number> = { win: 0, watch: 0, waste: 0 };
  classified.forEach(x => { counts[x.cl.tier] += 1; });

  return (
    <section className="dash-card p-4 sm:p-5" aria-label="Campaign performance tiers">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h4
          className="text-sm font-bold"
          style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
        >
          Campaign Performance
        </h4>
        <div className="flex items-center gap-3 text-xs">
          {(Object.keys(TIER_STYLE) as Tier[]).map(t => (
            <span key={t} className="inline-flex items-center gap-1" style={{ color: TIER_STYLE[t].color, cursor: "help" }} title={TIER_TOOLTIPS[t]}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: TIER_STYLE[t].color }} />
              {TIER_STYLE[t].label} ({counts[t]})
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {classified.map(({ campaign: c, cl }, i) => {
          const spend = Number(c.spend ?? 0);
          const conv = Number(c.conversions ?? 0);
          const roasVal = Number(c.roas ?? 0);
          return (
            <div
              key={String(c.campaignId ?? i)}
              className="py-2"
              style={{ borderBottom: i < classified.length - 1 ? "1px solid var(--gaf-row-border)" : "none" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TIER_STYLE[cl.tier].color }} aria-hidden="true" />
                <span
                  className="text-sm font-medium truncate flex-1 min-w-[140px]"
                  style={{ color: "var(--gaf-text-primary)" }}
                  title={String(c.campaign ?? "")}
                >
                  {String(c.campaign ?? "Unnamed")}
                </span>
                <TierBadge tier={cl.tier} metric={cl.metric} val={cl.val} />
                <span className="text-xs tabular-nums w-20 text-right" style={{ color: "var(--gaf-text-secondary)" }}>
                  {fmtCurrency(spend)}
                </span>
                <span className="text-xs tabular-nums w-16 text-right hidden sm:inline" style={{ color: "var(--gaf-text-muted)" }}>
                  {conv > 0 ? `${fmtInt(conv)} conv.` : "–"}
                </span>
                <span className="text-xs tabular-nums w-16 text-right hidden sm:inline" style={{ color: "var(--gaf-text-muted)" }}>
                  {roasVal > 0 ? fmtRoas(roasVal) : "–"}
                </span>
              </div>
              <div className="mt-1.5 h-0.5 rounded-full overflow-hidden ml-4" style={{ background: "var(--gaf-row-border)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(spend / maxSpend) * 100}%`, background: TIER_STYLE[cl.tier].color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- BudgetAtRiskPanel ----

export function BudgetAtRiskPanel({ campaigns }: { campaigns: MetaEntityRow[] }) {
  if (!campaigns.length) return null;

  const bench = campaignBenchmarks(campaigns);
  const wasteCampaigns = campaigns.filter(c => classifyCampaign(c, bench).tier === 'waste');
  const wasteSpend = wasteCampaigns.reduce((a, c) => a + Number(c.spend ?? 0), 0);

  if (wasteSpend <= 0) return null;

  return (
    <section
      className="dash-card p-4 sm:p-5"
      style={{ borderLeft: "4px solid var(--gaf-delta-neg)" }}
      aria-label="Budget at risk"
    >
      <p
        className="text-sm font-semibold"
        style={{ color: "var(--gaf-delta-neg)", fontFamily: "var(--font-display)" }}
      >
        Budget at risk: {fmtCurrency(wasteSpend)} – {wasteCampaigns.length} campaign{wasteCampaigns.length === 1 ? "" : "s"} underperforming
      </p>
      {wasteCampaigns.length > 0 && (
        <ul className="mt-2 space-y-1">
          {wasteCampaigns.map((c, i) => (
            <li key={String(c.campaignId ?? i)} className="text-xs" style={{ color: "var(--gaf-text-muted)" }}>
              {String(c.campaign ?? "Unnamed")} – {fmtCurrency(Number(c.spend ?? 0))} spend
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- ScaleWinnersPanel ----

interface ScaleWinnersPanelProps {
  adsets: MetaEntityRow[];
  /** Snapshot campaigns — the median campaign ROAS is the scaling benchmark */
  campaigns: MetaEntityRow[];
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>
        {label}
      </span>
      <span
        className="text-xs font-bold tabular-nums"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function ScaleWinnersPanel({ adsets, campaigns }: ScaleWinnersPanelProps) {
  // Reference benchmark: MEDIAN campaign ROAS (not the blended account ROAS,
  // which a single outlier campaign can inflate past every real ad set).
  const benchmarkRoas = medianPositive((campaigns ?? []).map(c => Number(c.roas ?? 0)));

  const winners = (adsets ?? [])
    .filter(a =>
      Number(a.roas ?? 0) > benchmarkRoas &&
      Number(a.conversions ?? 0) >= 2 &&
      Number(a.spend ?? 0) >= 200
    )
    .sort((a, b) => Number(b.roas ?? 0) - Number(a.roas ?? 0))
    .slice(0, 5);

  if (!winners.length) return null;

  return (
    <section className="dash-card p-4 sm:p-5" aria-label="Scale winners ad sets">
      <h4
        className="text-sm font-bold mb-3"
        style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
      >
        Scale Winners
      </h4>
      <p className="text-xs mb-3" style={{ color: "var(--gaf-text-muted)" }}>
        Ad sets above the median campaign ROAS with 2+ conversions and $200+ spend
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {winners.map((a, i) => (
          <div
            key={String(a.adsetId ?? i)}
            className="rounded-lg p-3 border"
            style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
          >
            <p
              className="text-xs font-semibold leading-snug line-clamp-2 mb-0.5"
              style={{ color: "#14532d" }}
              title={String(a.adset ?? "")}
            >
              {String(a.adset ?? "Unnamed Ad Set")}
            </p>
            {Boolean(a.campaign) && (
              <p className="text-[10px] truncate mb-1.5" style={{ color: "#166534" }} title={String(a.campaign)}>
                {String(a.campaign)}
              </p>
            )}
            <p
              className="text-2xl font-bold tabular-nums mb-2"
              style={{ color: "var(--gaf-delta-pos)", fontFamily: "var(--font-display)" }}
            >
              {fmtRoas(Number(a.roas ?? 0))}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <MiniStat label="Spend" value={fmtCurrency(Number(a.spend ?? 0))} />
              <MiniStat label="Conv." value={fmtInt(Number(a.conversions ?? 0))} />
              <MiniStat label="Revenue" value={fmtCurrency(Number(a.convValue ?? 0))} />
              <MiniStat label="CTR" value={fmtPct(Number(a.ctr ?? 0))} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
