// src/components/Delta.test.tsx
// Regression (2026-07-11 audit): inverted metrics used to flip the ARROW too,
// rendering "▲ -8.2%" (up-arrow, negative number) on Cost/ATC cards.
import { render, screen } from "@testing-library/react";
import { Delta } from "./Delta";

test("arrow always follows the actual direction of movement", () => {
  const { rerender } = render(<Delta pct={-8.2} invert />);
  // Falling CPA: down-arrow with the negative number...
  expect(screen.getByText("▼")).toBeInTheDocument();
  expect(screen.getByText("-8.2%")).toBeInTheDocument();

  rerender(<Delta pct={36.4} invert />);
  // Rising CPC: up-arrow with the positive number
  expect(screen.getByText("▲")).toBeInTheDocument();
  expect(screen.getByText("+36.4%")).toBeInTheDocument();
});

test("colour flips for lower-is-better metrics", () => {
  // Falling CPA (good) → positive colour token
  const { container, rerender } = render(<Delta pct={-8.2} invert />);
  expect((container.firstChild as HTMLElement).style.color).toContain("--gaf-delta-pos");

  // Falling ROAS (bad) → negative colour token
  rerender(<Delta pct={-8.2} />);
  expect((container.firstChild as HTMLElement).style.color).toContain("--gaf-delta-neg");
});

test("extreme deltas are capped at >999%", () => {
  render(<Delta pct={8900} />);
  expect(screen.getByText(">999%")).toBeInTheDocument();
});
