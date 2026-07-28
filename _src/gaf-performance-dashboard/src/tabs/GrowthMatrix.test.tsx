import { render, screen, fireEvent } from "@testing-library/react";
import { GrowthMatrix } from "./GrowthMatrix";

// Two months; July has one real day (values from the sheet's 2 Jul 2026 column).
const day = (date: string, hasData: boolean, metrics: Record<string, number | null> = {}) => ({
  date,
  hasData,
  ...metrics,
});

const data: any = {
  growthMatrix: {
    dataThrough: "2026-07-21",
    agencyFeeRate: 0.08,
    drivers: {},
    months: [
      {
        key: "2026-06",
        label: "June 2026",
        daysInMonth: 30,
        daysElapsed: 30,
        days: Array.from({ length: 30 }, (_, i) =>
          day(`2026-06-${String(i + 1).padStart(2, "0")}`, true, { totalRevenue: 1000 })
        ),
        totals: { totalRevenue: 30000, contributionProfit: 5000, contributionMarginPct: 0.1667, totalMer: 0.1, paidSpendMer: 0.09, vcr: 0.6, totalAdvertising: 3000 },
        runRate: { totalRevenue: 30000 },
        notes: {},
      },
      {
        key: "2026-07",
        label: "July 2026",
        daysInMonth: 31,
        daysElapsed: 1,
        days: [
          day("2026-07-01", true, {
            totalRevenue: 46916.95,
            totalAdvertising: 8145.64,
            totalMer: 0.1736,
            contributionProfit: 7534.58,
            agencyFee: 580.58,
          }),
          ...Array.from({ length: 30 }, (_, i) =>
            day(`2026-07-${String(i + 2).padStart(2, "0")}`, false)
          ),
        ],
        totals: { totalRevenue: 46916.95, contributionProfit: 7534.58, contributionMarginPct: 0.1606, totalMer: 0.1736, paidSpendMer: 0.161, vcr: 0.5749, totalAdvertising: 8145.64 },
        runRate: { totalRevenue: 1454425.45, totalAdvertising: 252514.84, contributionProfit: 233571.98 },
        notes: { "2026-07-01": "Sales team outreach push" },
      },
    ],
  },
};

test("defaults to the latest month and shows its KPI totals", () => {
  render(<GrowthMatrix data={data} />);
  expect(screen.getByText("Growth Matrix")).toBeInTheDocument();
  // July (latest) is selected: revenue KPI shows the month total
  expect(screen.getAllByText("$46,917").length).toBeGreaterThan(0);
  // Partial month → run-rate subLabel on the revenue card
  expect(screen.getByText(/run rate \$1,454,425/)).toBeInTheDocument();
});

test("renders sheet-faithful rows including the 8% agency fee", () => {
  render(<GrowthMatrix data={data} />);
  expect(screen.getByText("Agency Fee (8%)")).toBeInTheDocument();
  // These appear as both a KPI card and a table row
  expect(screen.getAllByText("Total MER").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Contribution Profit").length).toBeGreaterThan(0);
  // MER formatted as a 2dp percent from the fraction
  expect(screen.getAllByText("17.36%").length).toBeGreaterThan(0);
});

test("switching month hides the run-rate column for complete months", () => {
  render(<GrowthMatrix data={data} />);
  expect(screen.getByText("Run Rate")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Select month"), { target: { value: "2026-06" } });
  expect(screen.queryByText("Run Rate")).not.toBeInTheDocument();
  expect(screen.getByText("complete month")).toBeInTheDocument();
});

test("shows the notes legend", () => {
  render(<GrowthMatrix data={data} />);
  expect(screen.getByText(/Sales team outreach push/)).toBeInTheDocument();
});

test("renders a friendly empty state when the section is missing", () => {
  render(<GrowthMatrix data={{} as any} />);
  expect(screen.getByText(/lands with the next nightly pull/)).toBeInTheDocument();
});
