import { describe, expect, it } from "vitest";
import { ALLOCATION_TIMES, DEFAULT_ALLOCATION_TIME, formatAllocationTime } from "./allocationTimes";

describe("ALLOCATION_TIMES", () => {
  it("has a time every 15 minutes across the day, in order", () => {
    expect(ALLOCATION_TIMES).toHaveLength(96);
    expect(ALLOCATION_TIMES.slice(0, 5)).toEqual(["00:00", "00:15", "00:30", "00:45", "01:00"]);
    expect(ALLOCATION_TIMES.at(-1)).toBe("23:45");
  });

  it("only has minutes the API accepts", () => {
    for (const time of ALLOCATION_TIMES) expect(time).toMatch(/^([01][0-9]|2[0-3]):(00|15|30|45)$/);
  });

  it("includes the default", () => {
    expect(ALLOCATION_TIMES).toContain(DEFAULT_ALLOCATION_TIME);
  });
});

describe("formatAllocationTime", () => {
  it("shows 24-hour time in pt-BR", () => {
    expect(formatAllocationTime("07:30", "pt-BR")).toBe("7:30");
    expect(formatAllocationTime("18:45", "pt-BR")).toBe("18:45");
  });

  it("shows 12-hour time in en-US", () => {
    expect(formatAllocationTime("07:30", "en-US")).toMatch(/^7:30\sAM$/);
    expect(formatAllocationTime("18:45", "en-US")).toMatch(/^6:45\sPM$/);
  });

  it("returns an unparsable value as it is", () => {
    expect(formatAllocationTime("soon", "en-US")).toBe("soon");
  });
});
