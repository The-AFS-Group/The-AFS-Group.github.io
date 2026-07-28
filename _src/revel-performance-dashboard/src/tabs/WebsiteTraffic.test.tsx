// src/tabs/WebsiteTraffic.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { WebsiteTraffic } from "./WebsiteTraffic";
import { DateRangeProvider } from "../state/DateRangeContext";
const data: any = {
  ga4: { "30d": { kpis: { sessions: 9000 }, deltas: {}, channels: [], topPages: [], geo: [{ region: "Victoria", sessions: 500 }], itemAtc: [], daily: [] } },
  products: { "30d": [{ handle: "c20-all-in-one", title: "C20", sessions: 1000, atc: 80, orders: 20, revenue: 79980, cvr: 2.0 }] },
};
test("renders product funnel row on the Products sub-tab", () => {
  render(<DateRangeProvider><WebsiteTraffic data={data} /></DateRangeProvider>);
  fireEvent.click(screen.getByRole("tab", { name: "Products" }));
  expect(screen.getByText("C20")).toBeInTheDocument();
  expect(screen.getByText(/2.0%|2%/)).toBeInTheDocument();
});
