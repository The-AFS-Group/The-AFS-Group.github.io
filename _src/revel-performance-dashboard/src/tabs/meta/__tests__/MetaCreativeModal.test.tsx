// src/tabs/meta/__tests__/MetaCreativeModal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetaCreativeModal } from "../MetaCreativeModal";
import type { MetaCreativeRow } from "../../../lib/data";

const mockCreative: MetaCreativeRow = {
  adId: "123",
  adName: "Test Ad – Summer Campaign",
  body: "Check out our amazing products",
  title: "Summer Sale",
  spend: 500,
  roas: 3.5,
  ctr: 2.1,
  purchases: 10,
  impressions: 5000,
  reach: 4000,
  clicks: 105,
  cpc: 4.76,
  cpm: 100,
  purchaseValue: 1750,
  cpa: 50,
  addToCart: 25,
  atcRate: 0.5,
  frequency: 1.25,
  outboundClicks: 80,
  landingPageViews: 75,
  engagements: 200,
  engagementRate: 4.0,
};

describe("MetaCreativeModal", () => {
  it("renders null when creative is null", () => {
    const { container } = render(
      <MetaCreativeModal creative={null} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with creative data", () => {
    render(
      <MetaCreativeModal creative={mockCreative} onClose={() => {}} />
    );
    expect(screen.getByText("Test Ad – Summer Campaign")).toBeTruthy();
    expect(screen.getByText("Summer Sale")).toBeTruthy();
    expect(screen.getByText("Check out our amazing products")).toBeTruthy();
  });

  it("closes on ESC key", () => {
    const onClose = vi.fn();
    render(<MetaCreativeModal creative={mockCreative} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows Ads Manager link when adId is set", () => {
    render(<MetaCreativeModal creative={mockCreative} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /ads manager/i });
    expect(link).toBeTruthy();
    expect((link as HTMLAnchorElement).href).toContain("123");
  });

  it("shows Preview Ad button when the feed carries a preview link", () => {
    render(
      <MetaCreativeModal
        creative={{ ...mockCreative, previewLink: "https://fb.me/preview/xyz" }}
        onClose={() => {}}
      />
    );
    const link = screen.getByRole("link", { name: /preview ad/i });
    expect((link as HTMLAnchorElement).href).toContain("fb.me/preview");
  });
});
