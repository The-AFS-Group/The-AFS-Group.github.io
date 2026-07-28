// src/tabs/Axon.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Axon } from "./Axon";
import { DateRangeProvider } from "../state/DateRangeContext";

// Fixture matches the REAL feed row keys: campaigns key on `campaign`,
// creative sets on `creativeSet` (binding these to `name` blanked both
// columns — 2026-07-11 audit).
const data: any = {
  axon: {
    "30d": {
      kpis: { spend: 350, sales: 1200, roas: 3.4, conversions: 4 },
      deltas: {},
      campaigns: [{ campaign: "GAF AU Conversion", spend: 350, conversions: 4, roas: 3.4, cpa: 87.5 }],
      creativeSets: [{ creativeSet: "C20_Review_SocialProof_HomeGym_v01", spend: 90 }],
      daily: [],
    },
  },
};

test("renders Axon campaign, creative set and learning caveat across sub-tabs", () => {
  render(<DateRangeProvider><Axon data={data} /></DateRangeProvider>);
  // Overview: caveat + top-campaigns panel
  expect(screen.getAllByText(/learning/i).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/GAF AU Conversion/)).toBeInTheDocument();
  // Campaigns sub-tab
  fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
  expect(screen.getByText(/GAF AU Conversion/)).toBeInTheDocument();
  // Creative Sets sub-tab
  fireEvent.click(screen.getByRole("tab", { name: "Creative Sets" }));
  expect(screen.getByText(/C20_Review_SocialProof/)).toBeInTheDocument();
});

test("renders the GA4 Axon-channel add-to-cart card with its session base and GA4 tooltip", () => {
  const withAtc: any = {
    axon: {
      "30d": {
        kpis: { spend: 271, sales: 0, roas: 0, cpa: 0, conversions: 0, gaAtc: 0, gaSessions: 918 },
        deltas: { gaAtc: null },
        campaigns: [],
        creativeSets: [],
        daily: [],
      },
    },
  };
  render(<DateRangeProvider><Axon data={withAtc} /></DateRangeProvider>);
  expect(screen.getByText("Add to Cart")).toBeInTheDocument();
  expect(screen.getByText(/of 918 GA4 sessions/)).toBeInTheDocument();
  // Tooltip opens on click and attributes the metric to GA4
  fireEvent.click(screen.getByText("Add to Cart"));
  expect(screen.getByText(/Measured in GA4, not AppLovin/)).toBeInTheDocument();
});

test("shows a dash for ROAS/CPA when there are no conversions", () => {
  const zeroConv: any = {
    axon: {
      "30d": {
        kpis: { spend: 10.33, sales: 0, roas: 0, cpa: 0, conversions: 0 },
        deltas: {},
        campaigns: [],
        creativeSets: [],
        daily: [],
      },
    },
  };
  render(<DateRangeProvider><Axon data={zeroConv} /></DateRangeProvider>);
  // ROAS and CPA cards both show a dash rather than $0 / 0.00x
  expect(screen.getAllByText("–").length).toBeGreaterThanOrEqual(2);
});
