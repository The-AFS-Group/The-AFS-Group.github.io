// src/tabs/Email.test.tsx
import { render, screen } from "@testing-library/react";
import { Email } from "./Email";
import { DateRangeProvider } from "../state/DateRangeContext";
const data: any = { hubspot: { "30d": { kpis: { totalSends: 4, avgOpenRate: 31.2, avgCtr: 5.4, totalRevenue: 0 }, sends: [{ name: "EOFY Final Call", sendDate: "2026-06-30", sends: 12000, openRate: 33.1, clickRate: 6.2 }] } } };
test("renders an email send row", () => {
  render(<DateRangeProvider><Email data={data} /></DateRangeProvider>);
  expect(screen.getByText("EOFY Final Call")).toBeInTheDocument();
});
