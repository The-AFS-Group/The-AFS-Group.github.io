// src/tabs/GoogleAds.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { GoogleAds } from "./GoogleAds";
import { DateRangeProvider } from "../state/DateRangeContext";

const data: any = { google: { "30d": { kpis: { spend: 20000, roas: 5.8, atc: 400 }, deltas: {}, campaigns: [{ name: "Shopping - All", spend: 20000, advertising_channel_type: "SHOPPING" }], adGroups: [], keywords: [], searchTerms: [], ads: [], daily: [] } } };

test("renders Google sub-tab nav", () => {
  render(<DateRangeProvider><GoogleAds data={data} /></DateRangeProvider>);
  expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Campaigns" })).toBeInTheDocument();
});

test("Campaigns sub-tab shows campaign row", () => {
  render(<DateRangeProvider><GoogleAds data={data} /></DateRangeProvider>);
  fireEvent.click(screen.getByRole("tab", { name: "Campaigns" }));
  expect(screen.getByText("Shopping - All")).toBeInTheDocument();
});

test("empty window shows graceful empty state", () => {
  render(
    <DateRangeProvider>
      <GoogleAds data={{ google: {} } as any} />
    </DateRangeProvider>
  );
  expect(screen.getByText(/no google ads data available/i)).toBeInTheDocument();
});
