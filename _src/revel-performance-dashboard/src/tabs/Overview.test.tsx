// src/tabs/Overview.test.tsx
import { render, screen } from "@testing-library/react";
import { Overview } from "./Overview";
import { DateRangeProvider } from "../state/DateRangeContext";

const data: any = {
  overview: { "30d": { kpis: { adSpend: 250, revenue: 1400, blendedMer: 5.6, sessions: 9000 }, deltas: {}, spendSplit: { meta: 100, google: 100, axon: 50 }, daily: [] } },
  anomalies: { "30d": [{ metric: "spend", channel: "meta", direction: "up", magnitudePct: 60, severity: "high", label: "Meta spend up 60% vs baseline" }] },
  narrative: { "30d": "Meta spend jumped without a matching sessions lift." },
};

test("renders blended MER and an anomaly", () => {
  render(<DateRangeProvider><Overview data={data} /></DateRangeProvider>);
  expect(screen.getByText(/5.6/)).toBeInTheDocument();
  expect(screen.getByText(/Meta spend up 60%/)).toBeInTheDocument();
});
