// src/tabs/meta/__tests__/MetaDecisionPanels.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CampaignTierPanel,
  BudgetAtRiskPanel,
  ScaleWinnersPanel,
  medianPositive,
  campaignBenchmarks,
  classifyCampaign,
} from "../MetaDecisionPanels";
import type { MetaEntityRow } from "../../../lib/data";

const winCampaign: MetaEntityRow = {
  campaignId: "1",
  campaign: "Win Campaign",
  objective: "OUTCOME_SALES",
  spend: 1000,
  roas: 5.0,
  ctr: 2.0,
  cpm: 10,
  conversions: 20,
  convValue: 5000,
};

const wasteCampaign: MetaEntityRow = {
  campaignId: "2",
  campaign: "Waste Campaign",
  objective: "OUTCOME_SALES",
  spend: 500,
  roas: 0.3,
  ctr: 0.1,
  cpm: 40,
  conversions: 1,
  convValue: 150,
};

const watchCampaign: MetaEntityRow = {
  campaignId: "3",
  campaign: "Watch Campaign",
  objective: "OUTCOME_SALES",
  spend: 200,
  roas: 2.5,
  ctr: 1.0,
  cpm: 20,
  conversions: 5,
  convValue: 500,
};

const winAdSet: MetaEntityRow = {
  adsetId: "a1",
  adset: "Scale Winner Ad Set",
  spend: 500,
  roas: 6.0,
  ctr: 3.0,
  conversions: 5,
  convValue: 3000,
};

describe("medianPositive", () => {
  it("takes the median, excluding zeros", () => {
    expect(medianPositive([0, 0, 2, 4, 6])).toBe(4);
    expect(medianPositive([2, 4])).toBe(3);
    expect(medianPositive([])).toBe(0);
    expect(medianPositive([0, 0])).toBe(0);
  });

  it("is not dragged by a single outlier the way a mean is", () => {
    // Regression (2026-07-11 audit): mean-with-zeros misclassified normal
    // campaigns as waste when one 34x ROAS outlier was present.
    const roas = [34.0, 3.0, 2.8, 3.2, 0];
    expect(medianPositive(roas)).toBe(3.1);   // vs mean 8.6
  });
});

describe("classifyCampaign", () => {
  it("judges a normal conversion campaign against the MEDIAN, not the mean", () => {
    const outlier: MetaEntityRow = { ...winCampaign, campaignId: "9", roas: 34.0 };
    const normal: MetaEntityRow = { ...watchCampaign, roas: 3.0, spend: 5000 };
    const others: MetaEntityRow[] = [
      { ...watchCampaign, campaignId: "4", roas: 2.8, spend: 900 },
      { ...watchCampaign, campaignId: "5", roas: 3.2, spend: 900 },
    ];
    const all = [outlier, normal, ...others];
    const bench = campaignBenchmarks(all);
    // Median ROAS ≈ 3.1 → a 3.0 campaign is "watch"/"win" territory, NOT waste
    const cl = classifyCampaign(normal, bench);
    expect(cl.tier).not.toBe("waste");
  });

  it("forces sub-$50 spend to watch", () => {
    const tiny: MetaEntityRow = { ...wasteCampaign, spend: 10 };
    const bench = campaignBenchmarks([winCampaign, tiny]);
    expect(classifyCampaign(tiny, bench).tier).toBe("watch");
  });
});

describe("CampaignTierPanel", () => {
  it("lists every campaign with its tier badge", () => {
    render(<CampaignTierPanel campaigns={[winCampaign, wasteCampaign, watchCampaign]} />);
    expect(screen.getByText("Win Campaign")).toBeTruthy();
    expect(screen.getByText("Waste Campaign")).toBeTruthy();
    expect(screen.getByText("Watch Campaign")).toBeTruthy();
    // Header legend counts + per-campaign badges both render "Win (…)"
    expect(screen.getAllByText(/Win \(/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Waste \(/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders nothing with empty campaigns", () => {
    const { container } = render(<CampaignTierPanel campaigns={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("BudgetAtRiskPanel", () => {
  it("renders budget at risk when waste campaigns exist", () => {
    render(<BudgetAtRiskPanel campaigns={[winCampaign, watchCampaign, wasteCampaign]} />);
    expect(screen.getByText(/budget at risk/i)).toBeTruthy();
    expect(screen.getByText(/waste campaign/i)).toBeTruthy();
  });

  it("renders nothing with empty campaigns", () => {
    const { container } = render(<BudgetAtRiskPanel campaigns={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ScaleWinnersPanel", () => {
  const campaigns = [winCampaign, watchCampaign];   // median campaign ROAS = 3.75

  it("renders ad sets beating the median campaign ROAS", () => {
    render(<ScaleWinnersPanel adsets={[winAdSet]} campaigns={campaigns} />);
    expect(screen.getByText("Scale Winners")).toBeTruthy();
    expect(screen.getByText("Scale Winner Ad Set")).toBeTruthy();
  });

  it("renders nothing when no qualifying ad sets", () => {
    const lowAdSet: MetaEntityRow = { adsetId: "x", adset: "Low", spend: 100, roas: 1.0, conversions: 1 };
    const { container } = render(<ScaleWinnersPanel adsets={[lowAdSet]} campaigns={campaigns} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing with empty adsets", () => {
    const { container } = render(<ScaleWinnersPanel adsets={[]} campaigns={campaigns} />);
    expect(container.firstChild).toBeNull();
  });
});
