// src/tabs/MetaAds.tsx
// Meta Ads tab shell: internal sub-tab bar routing to the meta/* sub-components.
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { CaveatBanner } from "../components/CaveatBanner";
import { MetaOverview } from "./meta/MetaOverview";
import { MetaCampaigns } from "./meta/MetaCampaigns";
import { MetaAdSets } from "./meta/MetaAdSets";
import { MetaCreative } from "./meta/MetaCreative";
import { MetaVideo } from "./meta/MetaVideo";
import { MetaBreakdowns } from "./meta/MetaBreakdowns";
import { MetaOrganic } from "./meta/MetaOrganic";
import type { PerfData, MetaWindow } from "../lib/data";

interface MetaAdsProps {
  data: PerfData;
}

const CAVEAT =
  "Many Revel sales close offline via phone. ROAS figures are directional only - not a performance verdict.";

type SubTab =
  | "overview"
  | "campaigns"
  | "adsets"
  | "creative"
  | "video"
  | "breakdowns"
  | "organic";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview",   label: "Overview" },
  { key: "campaigns",  label: "Campaigns" },
  { key: "adsets",     label: "Ad Sets" },
  { key: "creative",   label: "Creative" },
  { key: "video",      label: "Video" },
  { key: "breakdowns", label: "Breakdowns" },
  { key: "organic",    label: "Organic" },
];

export function MetaAds({ data }: MetaAdsProps) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("overview");

  const metaWin: MetaWindow = data.meta?.[window] ?? {};
  const hasWindow = Boolean(data.meta?.[window]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Sub-tab pill nav */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="Meta Ads sections"
      >
        {SUB_TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              style={{
                background: isActive ? "var(--gaf-primary)" : "transparent",
                color: isActive ? "#fff" : "var(--gaf-text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!hasWindow ? (
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No Meta Ads data available for this window.
        </div>
      ) : (
        <>
          {active === "overview"   && <MetaOverview metaWin={metaWin} window={window} />}
          {active === "campaigns"  && <MetaCampaigns metaWin={metaWin} />}
          {active === "adsets"     && <MetaAdSets metaWin={metaWin} />}
          {active === "creative"   && <MetaCreative metaWin={metaWin} />}
          {active === "video"      && <MetaVideo metaWin={metaWin} />}
          {active === "breakdowns" && <MetaBreakdowns metaWin={metaWin} />}
          {active === "organic"    && <MetaOrganic organic={data.organic} />}
        </>
      )}

      <CaveatBanner text={CAVEAT} />
    </div>
  );
}
