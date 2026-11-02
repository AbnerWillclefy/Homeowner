import { describe, expect, it } from "vitest";
import { completionBounds, fromLocalInput, pickedProblem, toLocalInput } from "./completionTimeBounds";

const SAO_PAULO = "America/Sao_Paulo"; // UTC-3 all year since 2019

describe("completionBounds", () => {
  it("ends at now and starts at the first instant of today-29 in the Home's zone", () => {
    const now = new Date("2030-01-15T15:00:00Z");
    const { min, max } = completionBounds(now, "2030-01-15", SAO_PAULO);
    expect(max).toEqual(now);
    // 2029-12-17 00:00 in Sao Paulo
    expect(min.toISOString()).toBe("2029-12-17T03:00:00.000Z");
  });

  it("counts the Home's day, not the device's, at a day boundary", () => {
    // 01:00 UTC on the 16th is still the 15th (22:00) in Sao Paulo, so the window starts on 2029-12-17, not 12-18.
    const now = new Date("2030-01-16T01:00:00Z");
    const { min } = completionBounds(now, "2030-01-15", SAO_PAULO);
    expect(min.toISOString()).toBe("2029-12-17T03:00:00.000Z");
  });

  it("reaches back across a month and a year end", () => {
    expect(completionBounds(new Date("2030-02-10T12:00:00Z"), "2030-02-10", "UTC").min.toISOString()).toBe("2030-01-12T00:00:00.000Z");
    expect(completionBounds(new Date("2030-01-10T12:00:00Z"), "2030-01-10", "UTC").min.toISOString()).toBe("2029-12-12T00:00:00.000Z");
  });
});

describe("pickedProblem", () => {
  const now = new Date("2030-01-15T15:00:00Z");
  const bounds = completionBounds(now, "2030-01-15", SAO_PAULO);

  it("accepts exactly now and exactly the start", () => {
    expect(pickedProblem("2030-01-15T12:00", bounds, SAO_PAULO)).toBeNull();
    expect(pickedProblem("2029-12-17T00:00", bounds, SAO_PAULO)).toBeNull();
  });

  it("refuses one minute after now as in_future", () => {
    expect(pickedProblem("2030-01-15T12:01", bounds, SAO_PAULO)).toBe("in_future");
  });

  it("refuses one minute before the start as too_old", () => {
    expect(pickedProblem("2029-12-16T23:59", bounds, SAO_PAULO)).toBe("too_old");
  });

  it("refuses an empty or malformed value as invalid", () => {
    expect(pickedProblem("", bounds, SAO_PAULO)).toBe("invalid");
    expect(pickedProblem("tomorrow", bounds, SAO_PAULO)).toBe("invalid");
  });

  it("reads the value in the device zone when the zones differ", () => {
    // A device in UTC picking 16:00 is after now (15:00Z), though the Home clock would read 13:00.
    expect(pickedProblem("2030-01-15T16:00", bounds, "UTC")).toBe("in_future");
    expect(pickedProblem("2030-01-15T14:59", bounds, "UTC")).toBeNull();
  });
});

describe("local input values", () => {
  it("writes an instant as the device zone's YYYY-MM-DDTHH:mm", () => {
    expect(toLocalInput(new Date("2030-01-15T12:02:30Z"), SAO_PAULO)).toBe("2030-01-15T09:02");
    expect(toLocalInput(new Date("2030-01-15T00:00:00Z"), "UTC")).toBe("2030-01-15T00:00");
  });

  it("reads one back to the same instant, and null for junk", () => {
    expect(fromLocalInput("2030-01-15T09:02", SAO_PAULO)?.toISOString()).toBe("2030-01-15T12:02:00.000Z");
    expect(fromLocalInput("2030-13-45T99:99", SAO_PAULO)).toBeNull();
    expect(fromLocalInput("", SAO_PAULO)).toBeNull();
  });

  it("reads a time across a DST change in the zone's new offset", () => {
    // Europe/Berlin springs forward 2030-03-31 at 02:00 local; 12:00 is CEST (UTC+2).
    expect(fromLocalInput("2030-03-31T12:00", "Europe/Berlin")?.toISOString()).toBe("2030-03-31T10:00:00.000Z");
    expect(fromLocalInput("2030-03-30T12:00", "Europe/Berlin")?.toISOString()).toBe("2030-03-30T11:00:00.000Z");
  });
});
