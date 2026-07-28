// src/tabs/MetaAds.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { MetaAds } from "./MetaAds";
import { DateRangeProvider } from "../state/DateRangeContext";

const data: any = {
  meta: {
    "30d": {
      kpis: { spend: 5000, roas: 4.2, impressions: 100000, cpm: 14.2, cpa: 80 },
      deltas: { spend: 5.1, cpm: -3.2 },
      campaigns: [{ campaign: "GAF Prospecting", spend: 5000, roas: 4.2 }],
      adsets: [{ adset: "Broad 35-65", campaign: "GAF Prospecting", spend: 2000, roas: 3.9 }],
      ads: [],
      daily: [{ date: "2026-06-11", spend: 200 }],
      creative: [
        { adId: "1", adName: "Bus Stop Hit", thumbnailUrl: "", spend: 900, roas: 5.1, ctr: 2.6, purchases: 12 },
      ],
      video: [
        { adId: "1", adName: "Bus Stop Hit", campaign: "GAF Prospecting", spend: 900, videoPlays: 1000, thruPlays: 80, p25Rate: 30, p50Rate: 15, p75Rate: 6, p100Rate: 3 },
      ],
      breakdowns: {
        platform: [{ segment: "facebook", spend: 3000, roas: 4.0 }],
        placement: [], age: [], gender: [], region: [],
      },
    },
  },
  organic: {
    ig: { reach: 976502, accountsEngaged: 9862, totalInteractions: 12073, views: 1784275, followerCount: 21451, posts: [{ id: "p1", caption: "Test post", mediaType: "IMAGE", likes: 23, comments: 6 }] },
    fbPage: { fanCount: 88179, talkingAbout: 949 },
  },
};

function renderTab() {
  return render(
    <DateRangeProvider>
      <MetaAds data={data} />
    </DateRangeProvider>
  );
}

test("renders Overview KPIs and Refresh live button by default", () => {
  renderTab();
  expect(screen.getByText("Total Spend")).toBeInTheDocument();
  expect(screen.getByText("ROAS")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /refresh live/i })).toBeInTheDocument();
});

test("Campaigns sub-tab shows the campaign table", () => {
  renderTab();
  fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
  expect(screen.getByText("GAF Prospecting")).toBeInTheDocument();
});

test("Creative sub-tab renders a creative card", () => {
  renderTab();
  fireEvent.click(screen.getByRole("tab", { name: "Creative" }));
  expect(screen.getByText("Bus Stop Hit")).toBeInTheDocument();
});

test("Video sub-tab renders retention data", () => {
  renderTab();
  fireEvent.click(screen.getByRole("tab", { name: "Video" }));
  expect(screen.getByText("Video Performance")).toBeInTheDocument();
});

test("Breakdowns sub-tab renders a platform segment", () => {
  renderTab();
  fireEvent.click(screen.getByRole("tab", { name: "Breakdowns" }));
  // "facebook" appears in both the spend-by-segment panel and the table
  expect(screen.getAllByText("facebook").length).toBeGreaterThanOrEqual(1);
});

test("Organic sub-tab renders IG KPIs and snapshot label", () => {
  renderTab();
  fireEvent.click(screen.getByRole("tab", { name: "Organic" }));
  expect(screen.getByText("Instagram")).toBeInTheDocument();
  expect(screen.getByText("30-day snapshot")).toBeInTheDocument();
});

test("empty window shows graceful empty state", () => {
  render(
    <DateRangeProvider>
      <MetaAds data={{ meta: {} } as any} />
    </DateRangeProvider>
  );
  expect(screen.getByText(/no meta ads data available/i)).toBeInTheDocument();
});
