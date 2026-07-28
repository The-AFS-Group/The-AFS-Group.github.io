// src/tabs/BingAds.tsx
// Microsoft Advertising (Bing) tab. Bing's window shape is identical to Google's,
// so the campaign/ad-group/ads tables reuse the generic Google table components;
// Overview and Search Terms are Bing-specific (no ATC / impression-share / keywords).
import { useState } from "react";
import { useDateRange } from "../state/DateRangeContext";
import { BingOverview } from "./bing/BingOverview";
import { BingSearchTerms } from "./bing/BingSearchTerms";
import { GoogleCampaigns } from "./google/GoogleCampaigns";
import { GoogleAdGroups } from "./google/GoogleAdGroups";
import { GoogleAdsTable } from "./google/GoogleAdsTable";
import type { PerfData } from "../lib/data";

interface BingAdsProps {
  data: PerfData;
}

type SubTab = "overview" | "campaigns" | "adgroups" | "searchterms" | "ads";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview",    label: "Overview" },
  { key: "campaigns",   label: "Campaigns" },
  { key: "adgroups",    label: "Ad Groups" },
  { key: "searchterms", label: "Search Terms" },
  { key: "ads",         label: "Ads" },
];

export function BingAds({ data }: BingAdsProps) {
  const { window } = useDateRange();
  const [active, setActive] = useState<SubTab>("overview");

  const bingWin = data.bing?.[window] ?? null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div
        className="inline-flex flex-wrap gap-1 p-1 rounded-xl"
        style={{ background: "var(--gaf-card-bg)", border: "1px solid var(--gaf-card-border)", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
        role="tablist"
        aria-label="Microsoft Ads sections"
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
              style={{ background: isActive ? "var(--gaf-primary)" : "transparent", color: isActive ? "#fff" : "var(--gaf-text-secondary)" }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {!bingWin ? (
        <div className="dash-card p-8 text-center text-sm" style={{ color: "var(--gaf-text-muted)" }}>
          No Microsoft Ads data available for this window.
        </div>
      ) : (
        <>
          {active === "overview"    && <BingOverview bingWin={bingWin} />}
          {active === "campaigns"   && <GoogleCampaigns googleWin={bingWin} />}
          {active === "adgroups"    && <GoogleAdGroups googleWin={bingWin} />}
          {active === "searchterms" && <BingSearchTerms bingWin={bingWin} />}
          {active === "ads"         && <GoogleAdsTable googleWin={bingWin} />}
        </>
      )}
    </div>
  );
}
