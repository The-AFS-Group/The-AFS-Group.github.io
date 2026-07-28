// src/components/AustraliaMap.test.tsx
import { render } from "@testing-library/react";
import { AustraliaMap } from "./AustraliaMap";
test("renders an svg path per mapped state", () => {
  const { container } = render(<AustraliaMap geo={[{ region: "Victoria", sessions: 500 }, { region: "New South Wales", sessions: 800 }]} />);
  expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
});
