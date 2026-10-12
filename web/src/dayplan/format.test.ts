import { describe, expect, it } from "vitest";
import { dueWhen, formatDay } from "./format";

describe("formatDay", () => {
  it("writes a calendar date the way the locale does, whatever the device's time zone", () => {
    expect(formatDay("2026-10-12", "en-US")).toBe("Oct 12");
    expect(formatDay("2026-10-12", "pt-BR")).toBe("12 de out.");
  });

  it("returns text it cannot read as it came", () => {
    expect(formatDay("soon", "en-US")).toBe("soon");
  });
});

describe("dueWhen", () => {
  it("places a Task's last day against the plan's day", () => {
    expect(dueWhen("2026-10-11", "2026-10-12")).toBe("past");
    expect(dueWhen("2026-10-12", "2026-10-12")).toBe("today");
    expect(dueWhen("2026-10-13", "2026-10-12")).toBe("later");
  });
});
