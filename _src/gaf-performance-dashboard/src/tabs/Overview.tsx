// src/tabs/Overview.tsx
import { useDateRange } from "../state/DateRangeContext";
import { KpiCard } from "../components/KpiCard";
import { TrendChart } from "../components/TrendChart";
import { CaveatBanner } from "../components/CaveatBanner";
import { SourceLink } from "../components/SourceLink";
import { fmtCurrency, fmtCurrencyCompact, fmtInt, fmtPct } from "../lib/format";
import type { PerfData, Anomaly } from "../lib/data";

interface OverviewProps {
  data: PerfData;
}

const CAVEAT =
  "Blended MER = (ad spend + 8% agency fee on Meta and Google + other marketing expenses) ÷ total NetSuite sales revenue; lower is more efficient. " +
  "Revenue is total sales from NetSuite (incl. phone/offline/B2B), so treat channel-level ROAS as directional, not a verdict.";

// Source documents behind the Revenue + MER widgets (GAF NetSuite export Sheet).
const SALES_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RRlMgNqAk-BN3PA8H3ywqSWLUJY-5_yG_EXy-X5JkUw/edit?gid=137601096#gid=137601096";
const EXPENSES_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RRlMgNqAk-BN3PA8H3ywqSWLUJY-5_yG_EXy-X5JkUw/edit?gid=762379671#gid=762379671";

function SeverityDot({ severity }: { severity: Anomaly["severity"] }) {
  const colour =
    severity === "high"
      ? "bg-red-500"
      : severity === "medium"
      ? "bg-amber-500"
      : "bg-gray-400";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${colour}`}
    />
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-lg font-bold mb-3"
      style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
    >
      {children}
    </h3>
  );
}

const SPLIT_COLOURS: Record<string, string> = {
  meta: "#1877F2",              // Meta blue
  google: "#34A853",            // Google green
  axon: "var(--gaf-primary)",   // brand orange
};

function SpendSplitBar({
  meta,
  google,
  axon,
}: {
  meta: number;
  google: number;
  axon: number;
}) {
  const total = meta + google + axon;
  if (total === 0) return null;

  const entries = [
    { key: "meta", label: "Meta", value: meta },
    { key: "google", label: "Google", value: google },
    { key: "axon", label: "Axon", value: axon },
  ].filter(e => e.value > 0);

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-3" style={{ background: "var(--gaf-row-border)" }}>
        {entries.map(e => (
          <div
            key={e.key}
            style={{ width: `${(e.value / total) * 100}%`, background: SPLIT_COLOURS[e.key] }}
            title={`${e.label} ${fmtCurrency(e.value)}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: "var(--gaf-text-secondary)" }}>
        {entries.map(e => (
          <span key={e.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: SPLIT_COLOURS[e.key] }} />
            {e.label}{" "}
            <span className="font-semibold tabular-nums" style={{ color: "var(--gaf-text-primary)" }}>
              {fmtCurrency(e.value)}
            </span>
            <span style={{ color: "var(--gaf-text-muted)" }}>({((e.value / total) * 100).toFixed(0)}%)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Overview({ data }: OverviewProps) {
  const { window } = useDateRange();

  const ov = data.overview?.[window];
  const anomalies = data.anomalies?.[window] ?? [];
  const narrative = data.narrative?.[window] ?? null;

  if (!ov) {
    return (
      <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
        No overview data available for this window.
      </div>
    );
  }

  const { kpis, deltas = {}, spendSplit, daily } = ov;

  // Spend trend series
  const hasDailyData = daily && daily.length > 0;

  return (
    <div className="space-y-6 fade-in">
      {/* KPI row */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger">
          <KpiCard
            label="Ad Spend"
            value={fmtCurrency(kpis.adSpend ?? 0)}
            delta={deltas.adSpend ?? null}
            tooltip="Source: Meta, Google Ads and AppLovin (Axon) APIs, pulled nightly. Calculation: sum of media spend for the selected window. Excludes the 8% agency fee (that enters the MER only)."
          />
          <KpiCard
            label="Revenue"
            value={fmtCurrency(kpis.revenue ?? 0)}
            delta={deltas.revenue ?? null}
            subLabel={kpis.shopifyRevenue ? `Shopify: ${fmtCurrency(kpis.shopifyRevenue)}` : undefined}
            sources={[{ href: SALES_SHEET_URL, title: "Source: NetSuite Sales Array (Google Sheet)" }]}
            tooltip="Source: NetSuite Sales Array (total sales orders, published sheet). Calculation: sum of the Amount column for orders dated in the window. Captures phone, offline and B2B sales that Shopify and GA4 never see; Shopify online revenue shown below for reference."
          />
          <KpiCard
            label="Blended MER"
            value={fmtPct(kpis.blendedMer ?? 0)}
            delta={deltas.blendedMer ?? null}
            invertDelta
            subLabel={
              kpis.marketingExpenses
                ? `incl. ${fmtCurrency(kpis.agencyFees ?? 0)} fee + ${fmtCurrency(kpis.marketingExpenses)} exp`
                : kpis.agencyFees
                ? `incl. ${fmtCurrency(kpis.agencyFees)} agency fee`
                : undefined
            }
            sources={[
              { href: SALES_SHEET_URL, title: "Revenue source: NetSuite Sales Array (Google Sheet)" },
              { href: EXPENSES_SHEET_URL, title: "Expenses source: marketing expenses ledger (Google Sheet)" },
            ]}
            tooltip="Sources: ad platform APIs + marketing expenses ledger, over NetSuite sales. Calculation: (media spend + 8% agency fee on Meta and Google + non-media marketing expenses) ÷ total NetSuite sales revenue. Lower is more efficient; team target ~12%. Note: the expenses ledger lags a few days, so very recent windows understate the numerator. Delta compares the prior equal period."
          />
          <KpiCard
            label="Sessions"
            value={fmtInt(kpis.sessions ?? 0)}
            delta={deltas.sessions ?? null}
            tooltip="Source: GA4 (gymandfitness.com.au property), filtered to Australian traffic only. Calculation: total sessions in the window."
          />
          {kpis.onlineRevenue != null && kpis.onlineRevenue > 0 && (
            <KpiCard
              label="Online Revenue"
              value={fmtCurrency(kpis.onlineRevenue)}
              delta={deltas.onlineRevenue ?? null}
              tooltip="Source: GA4 purchase revenue, Australian traffic only. The online-attributed subset of total sales — the gap between this and Revenue is offline/phone/B2B sales."
            />
          )}
        </div>
      </section>

      {/* Gross profit vs budget (finance sheet) */}
      {kpis.gpCreated != null && kpis.gpBudget != null && kpis.gpBudget > 0 && (
        <section className="dash-card p-5" aria-label="Gross profit vs budget">
          <div className="flex items-center gap-2 mb-3">
            <h3
              className="text-lg font-bold"
              style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}
            >
              Gross Profit vs Budget
            </h3>
            <SourceLink
              href="https://docs.google.com/spreadsheets/d/17an6G2laOVcI8t0nDNsRkiax-ihYUIUqGtviyfaX9Gw/edit"
              title="Source: FY27 daily GP budget/forecast (Google Sheet, GAF DATA tab)"
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>
                GP Created
              </p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
                {fmtCurrency(kpis.gpCreated)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>
                Budget (same days)
              </p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "var(--gaf-text-secondary)", fontFamily: "var(--font-display)" }}>
                {fmtCurrency(kpis.gpBudget)}
              </p>
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>
                vs Budget
              </p>
              {kpis.gpVariancePct != null && (
                <p
                  className="text-xl sm:text-2xl font-bold tabular-nums"
                  style={{
                    color: kpis.gpVariancePct >= 0 ? "var(--gaf-delta-pos)" : "var(--gaf-delta-neg)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {kpis.gpVariancePct >= 0 ? "+" : ""}{kpis.gpVariancePct.toFixed(1)}%
                </p>
              )}
            </div>
            {ov.gpMonth?.runRate != null && ov.gpMonth.monthBudget != null && ov.gpMonth.monthBudget > 0 && (
              <div>
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider" style={{ color: "var(--gaf-text-muted)" }}>
                  {ov.gpMonth.label ?? "Month"} run rate
                </p>
                <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "var(--gaf-text-primary)", fontFamily: "var(--font-display)" }}>
                  {fmtCurrency(ov.gpMonth.runRate)}
                </p>
                <p className="text-[11px] tabular-nums" style={{ color: "var(--gaf-text-muted)" }}>
                  vs {fmtCurrency(ov.gpMonth.monthBudget)} budget
                  {ov.gpMonth.runRateVsBudgetPct != null && (
                    <span
                      className="ml-1 font-semibold"
                      style={{ color: ov.gpMonth.runRateVsBudgetPct >= 0 ? "var(--gaf-delta-pos)" : "var(--gaf-delta-neg)" }}
                    >
                      ({ov.gpMonth.runRateVsBudgetPct >= 0 ? "+" : ""}{ov.gpMonth.runRateVsBudgetPct.toFixed(1)}%)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Month-to-date progress vs full month budget */}
          {ov.gpMonth?.mtdActual != null && ov.gpMonth.monthBudget != null && ov.gpMonth.monthBudget > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: "var(--gaf-text-muted)" }}>
                <span>
                  MTD {fmtCurrency(ov.gpMonth.mtdActual)} of {fmtCurrency(ov.gpMonth.monthBudget)}
                  {" "}({ov.gpMonth.daysElapsed}/{ov.gpMonth.daysInMonth} days)
                </span>
                <span>marker = budget to date</span>
              </div>
              <div className="relative w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--gaf-row-border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (ov.gpMonth.mtdActual / ov.gpMonth.monthBudget) * 100)}%`,
                    background:
                      (ov.gpMonth.mtdBudget ?? 0) > 0 && ov.gpMonth.mtdActual < (ov.gpMonth.mtdBudget ?? 0)
                        ? "var(--gaf-delta-neg)"
                        : "var(--gaf-delta-pos)",
                  }}
                />
                {(ov.gpMonth.mtdBudget ?? 0) > 0 && (
                  <div
                    className="absolute top-0 h-full w-0.5"
                    style={{
                      left: `${Math.min(100, ((ov.gpMonth.mtdBudget ?? 0) / ov.gpMonth.monthBudget) * 100)}%`,
                      background: "var(--gaf-text-secondary)",
                    }}
                  />
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] mt-3" style={{ color: "var(--gaf-text-muted)" }}>
            Gross profit created vs the FY daily budget (finance sheet). Budget compares only days with actuals entered; run rate projects month-to-date GP across the calendar month.
          </p>
        </section>
      )}

      {/* Channel spend split */}
      {spendSplit && (
        <section className="dash-card p-5" aria-label="Channel spend split">
          <SectionTitle>Channel Spend Split</SectionTitle>
          <SpendSplitBar
            meta={spendSplit.meta ?? 0}
            google={spendSplit.google ?? 0}
            axon={spendSplit.axon ?? 0}
          />
        </section>
      )}

      {/* Daily spend trend */}
      {hasDailyData && (
        <section className="dash-card p-5" aria-label="Daily spend trend">
          <SectionTitle>Daily Spend Trend</SectionTitle>
          <TrendChart
            data={daily}
            series={{
              areas: [{ key: "spend", color: "var(--gaf-primary)", label: "Ad Spend", format: fmtCurrencyCompact }],
            }}
          />
        </section>
      )}

      {/* Anomaly section */}
      {(anomalies.length > 0 || narrative) && (
        <section className="dash-card p-5 space-y-3" aria-label="Anomalies and insights">
          <SectionTitle>Anomalies &amp; Insights</SectionTitle>

          {narrative && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--gaf-text-secondary)" }}>
              {narrative}
            </p>
          )}

          {anomalies.length > 0 && (
            <ul className="space-y-2">
              {anomalies.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <SeverityDot severity={a.severity} />
                  <span
                    className="text-sm"
                    style={{
                      color:
                        a.severity === "high"
                          ? "#b91c1c"
                          : a.severity === "medium"
                          ? "#b45309"
                          : "var(--gaf-text-secondary)",
                    }}
                  >
                    {a.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Caveat banner */}
      <CaveatBanner text={CAVEAT} />
    </div>
  );
}
