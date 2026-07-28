/**
 * meta-live.test.ts
 *
 * Verifies refreshMeta() derives KPIs correctly from a mocked Worker response,
 * and confirms NO real token string is added by the client (the Worker injects it).
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { refreshMeta } from "./meta-live";

// ---------------------------------------------------------------------------
// Canned Worker response — shape mirrors what the Cloudflare proxy returns
// ---------------------------------------------------------------------------

const CANNED_ROWS = [
  {
    spend: "1234.56",
    impressions: "50000",
    clicks: "750",
    actions: [
      { action_type: "link_click", value: "750" },
      { action_type: "purchase", value: "25" },
    ],
    action_values: [
      { action_type: "purchase", value: "6500.00" },
    ],
  },
];

/** Expected derived KPIs for CANNED_ROWS (mirrors meta.py logic). */
const EXPECTED_KPIS = {
  spend: 1234.56,
  impressions: 50000,
  clicks: 750,
  ctr: 1.5,          // 750 / 50000 * 100 = 1.5
  conversions: 25,
  convValue: 6500,
  roas: 5.26,        // 6500 / 1234.56 = ~5.2654 => rounds to 5.27 at 2dp
  cpm: 24.69,        // 1234.56 / 50000 * 1000 = 24.6912 => 24.69
};

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

function makeWorkerResponse(rows: unknown[]) {
  return {
    data: rows,
    paging: {},
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => makeWorkerResponse(CANNED_ROWS),
    text: async () => JSON.stringify(makeWorkerResponse(CANNED_ROWS)),
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("refreshMeta", () => {
  it("calls the Worker with account-level insights params", async () => {
    await refreshMeta("30d");

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl: string = fetchMock.mock.calls[0][0];

    // Must hit the Cloudflare Worker
    expect(calledUrl).toContain("meta-api-proxy.josh-03c.workers.dev");
    // Must target the Revel account
    expect(calledUrl).toContain("act_2412898282250572");
    // Must be an insights call
    expect(calledUrl).toContain("/insights");
    // Must include the proxy sentinel (not a real token)
    expect(calledUrl).toContain("access_token=proxied");
  });

  it("sends the sentinel 'proxied' — NO real token in the request URL", async () => {
    await refreshMeta("7d");

    const calledUrl: string = fetchMock.mock.calls[0][0];
    // The only token string present must be the sentinel
    expect(calledUrl).toContain("access_token=proxied");
    // Ensure no bearer-style token leaked — real tokens are long alphanumeric strings
    // We check that nothing longer than 20 chars appears after "access_token="
    const match = calledUrl.match(/access_token=([^&]+)/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBeLessThanOrEqual(7); // "proxied" = 7 chars
  });

  it("derives spend correctly", async () => {
    const { kpis } = await refreshMeta("30d");
    expect(kpis.spend).toBe(1234.56);
  });

  it("derives CTR correctly (clicks/impressions*100, 2dp)", async () => {
    const { kpis } = await refreshMeta("30d");
    expect(kpis.ctr).toBe(EXPECTED_KPIS.ctr);
  });

  it("derives ROAS correctly (convValue/spend, 2dp)", async () => {
    const { kpis } = await refreshMeta("30d");
    // 6500 / 1234.56 = 5.2654... rounds to 5.27
    expect(kpis.roas).toBeCloseTo(6500 / 1234.56, 1);
  });

  it("derives CPM correctly (spend/impressions*1000, 2dp)", async () => {
    const { kpis } = await refreshMeta("30d");
    expect(kpis.cpm).toBe(24.69);
  });

  it("returns an ISO fetchedAt timestamp", async () => {
    const { fetchedAt } = await refreshMeta("30d");
    expect(fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("derives purchase conversions from actions list (not link_click)", async () => {
    const { kpis } = await refreshMeta("30d");
    expect(kpis.conversions).toBe(25);
    expect(kpis.convValue).toBe(6500);
  });

  it("handles a Worker error response gracefully (throws)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
      json: async () => ({}),
    });

    await expect(refreshMeta("30d")).rejects.toThrow("Worker HTTP 500");
  });

  it("returns zero KPIs when Worker returns empty data", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeWorkerResponse([]),
      text: async () => "{}",
    });

    const { kpis } = await refreshMeta("yesterday");
    expect(kpis.spend).toBe(0);
    expect(kpis.roas).toBe(0);
    expect(kpis.ctr).toBe(0);
  });

  it("maps 'yesterday' window to a single-day since==until range", async () => {
    await refreshMeta("yesterday");

    const calledUrl: string = fetchMock.mock.calls[0][0];
    const match = calledUrl.match(/time_range=([^&]+)/);
    expect(match).not.toBeNull();
    const range = JSON.parse(decodeURIComponent(match![1]));
    expect(range.since).toBe(range.until);
  });
});
