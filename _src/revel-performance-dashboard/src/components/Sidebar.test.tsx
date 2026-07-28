// src/components/Sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

test("renders all channel nav items", () => {
  render(<Sidebar active="overview" onSelect={() => {}} />);
  ["Overview","Meta Ads","Google Ads","Website Traffic","Email","Marketing Expenses"].forEach(label =>
    expect(screen.getByText(label)).toBeInTheDocument());
});
