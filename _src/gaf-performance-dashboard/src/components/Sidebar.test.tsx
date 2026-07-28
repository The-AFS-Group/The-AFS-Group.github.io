// src/components/Sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

test("renders all six channel nav items", () => {
  render(<Sidebar active="overview" onSelect={() => {}} />);
  ["Overview","Meta Ads","Google Ads","Website Traffic","Axon","Email"].forEach(label =>
    expect(screen.getByText(label)).toBeInTheDocument());
});
