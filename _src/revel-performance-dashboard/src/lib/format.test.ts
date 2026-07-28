import { expect, test } from "vitest";
import { fmtCurrency, fmtPct, fmtDelta } from "./format";

test("fmtCurrency AUD no cents", () => {
  expect(fmtCurrency(1234.5)).toBe("$1,235");
});

test("fmtPct one decimal", () => {
  expect(fmtPct(12.34)).toBe("12.3%");
});

test("fmtDelta direction", () => {
  expect(fmtDelta(5).dir).toBe("up");
  expect(fmtDelta(-5).dir).toBe("down");
  expect(fmtDelta(null).text).toBe("–");
});
