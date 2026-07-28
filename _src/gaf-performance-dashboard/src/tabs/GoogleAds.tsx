// src/tabs/GoogleAds.tsx
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { GoogleOverview } from "./google/GoogleOverview";
import { GoogleCampaigns } from "./google/GoogleCampaigns";
import { GoogleAdGroups } from "./google/GoogleAdGroups";
import { GoogleKeywordsSearchTerms } from "./google/GoogleKeywordsSearchTerms";
import { GoogleAdsTable } from "./google/GoogleAdsTable";
import type { PerfData } from "../lib/data";

interface GoogleAdsProps {
  data: PerfData;
}

type SubTab = "overview" | "campaigns" | "adgroups" | "keywords" | "ads";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview",   label: "Overview" },
  { key: "campaigns",  label: "Campaigns" },
  { key: "adgroups",   label: "Ad Groups" },
  { key: "keywords",   label: "Keywords / Search Terms" },
  { key: "ads",        label: "Ads" },
];

export function GoogleAds({ data }: GoogleAdsProps) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("overview");

  const googleWin = data.google?.[window] ?? null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Sub-tab pill nav */}
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="Google Ads sections"
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

      {!googleWin ? (
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No Google Ads data available for this window.
        </div>
      ) : (
        <>
          {active === "overview"  && <GoogleOverview googleWin={googleWin} />}
          {active === "campaigns" && <GoogleCampaigns googleWin={googleWin} />}
          {active === "adgroups"  && <GoogleAdGroups googleWin={googleWin} />}
          {active === "keywords"  && <GoogleKeywordsSearchTerms googleWin={googleWin} />}
          {active === "ads"       && <GoogleAdsTable googleWin={googleWin} />}
        </>
      )}
    </div>
  );
}
