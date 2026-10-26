import { describe, expect, it } from "vitest";
import { formatLatency, formatMicros, formatPercent, formatTokens } from "./format";

describe("formatMicros", () => {
  it("uses four decimals below one cent", () => {
    expect(formatMicros(4_560)).toBe("$0.0046");
    expect(formatMicros(0)).toBe("$0.0000");
  });
  it("uses two decimals from one cent up", () => {
    expect(formatMicros(12_300)).toBe("$0.01");
    expect(formatMicros(10_000)).toBe("$0.01");
    expect(formatMicros(1_234_567)).toBe("$1.23");
    expect(formatMicros(25_000_000)).toBe("$25.00");
  });
});

describe("formatTokens", () => {
  it("adds thousands separators", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1234567)).toBe("1,234,567");
  });
});

describe("formatLatency", () => {
  it("shows null as n/a", () => expect(formatLatency(null)).toBe("n/a"));
  it("shows milliseconds below 1000", () => {
    expect(formatLatency(420)).toBe("420 ms");
    expect(formatLatency(999)).toBe("999 ms");
  });
  it("switches to seconds at 1000", () => {
    expect(formatLatency(1000)).toBe("1.0 s");
    expect(formatLatency(2450)).toBe("2.5 s");
  });
});

describe("formatPercent", () => {
  it("guards a zero denominator", () => expect(formatPercent(0, 0)).toBe("n/a"));
  it("rounds to a whole percent", () => {
    expect(formatPercent(1, 3)).toBe("33%");
    expect(formatPercent(3, 3)).toBe("100%");
    expect(formatPercent(0, 5)).toBe("0%");
  });
});
