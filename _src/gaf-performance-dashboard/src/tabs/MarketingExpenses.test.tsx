import { render, screen, fireEvent } from "@testing-library/react";
import { MarketingExpenses } from "./MarketingExpenses";
import { DateRangeProvider } from "../state/DateRangeContext";

const data: any = {
  expenses: {
    "30d": {
      lineItems: [
        { name: "Facebook (AFS)", category: "PAID ADVERTISING", mediaSpend: true, amount: 47163, count: 18 },
        { name: "Smile, Inc.", category: "TECH & FEES", mediaSpend: false, amount: 4100, count: 1 },
        { name: "Klaviyo Inc.", category: "EMAIL MARKETING", mediaSpend: false, amount: 2504, count: 1 },
      ],
      total: 53767,
      totalExMedia: 6604,
      count: 3,
      dataThrough: "2026-07-08",
    },
  },
};

test("defaults to excluding ad spend — media vendor hidden, non-media shown", () => {
  render(<DateRangeProvider><MarketingExpenses data={data} /></DateRangeProvider>);
  expect(screen.getByText("Smile, Inc.")).toBeInTheDocument();
  expect(screen.queryByText("Facebook (AFS)")).not.toBeInTheDocument();
});

test("toggling off reveals the ad-spend line item", () => {
  render(<DateRangeProvider><MarketingExpenses data={data} /></DateRangeProvider>);
  fireEvent.click(screen.getByRole("button", { name: /exclude ad spend/i }));
  expect(screen.getByText("Facebook (AFS)")).toBeInTheDocument();
});
