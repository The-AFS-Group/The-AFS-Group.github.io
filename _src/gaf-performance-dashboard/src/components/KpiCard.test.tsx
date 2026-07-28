// src/components/KpiCard.test.tsx
import { render, screen } from "@testing-library/react";
import { KpiCard } from "./KpiCard";

test("shows label, value, and up delta", () => {
  render(<KpiCard label="Ad Spend" value="$250" delta={12.5} />);
  expect(screen.getByText("Ad Spend")).toBeInTheDocument();
  expect(screen.getByText("$250")).toBeInTheDocument();
  expect(screen.getByText(/12.5%/)).toBeInTheDocument();
});
