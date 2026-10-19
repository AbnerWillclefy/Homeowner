import { describe, expect, it } from "vitest";
import { dueWhen, formatDay, formatTime } from "./format";

describe("formatDay", () => {
  it("writes a calendar date the way the locale does, whatever the device's time zone", () => {
    expect(formatDay("2026-10-12", "en-US")).toBe("Oct 12");
    expect(formatDay("2026-10-12", "pt-BR")).toBe("12 de out.");
  });

  it("returns text it cannot read as it came", () => {
    expect(formatDay("soon", "en-US")).toBe("soon");
  });
});

describe("formatTime", () => {
  it("writes the clock time of an instant the way the locale does, in the given zone", () => {
    expect(formatTime("2026-10-11T14:30:00Z", "en-US", "UTC")).toBe("2:30 PM");
    expect(formatTime("2026-10-11T14:30:00Z", "pt-BR", "UTC")).toBe("14:30");
    expect(formatTime("2026-10-11T14:30:00Z", "pt-BR", "America/Sao_Paulo")).toBe("11:30");
  });

  it("reads the previous evening in the Home's zone when the instant is early UTC", () => {
    expect(formatTime("2026-10-12T02:30:00Z", "pt-BR", "America/Sao_Paulo")).toBe("23:30");
    expect(formatTime("2026-10-12T02:30:00Z", "en-US", "America/Sao_Paulo")).toBe("11:30 PM");
  });

  it("returns text it cannot read as it came", () => {
    expect(formatTime("later", "en-US")).toBe("later");
  });
});

describe("dueWhen", () => {
  it("places a Task's last day against the plan's day", () => {
    expect(dueWhen("2026-10-11", "2026-10-12")).toBe("past");
    expect(dueWhen("2026-10-12", "2026-10-12")).toBe("today");
    expect(dueWhen("2026-10-13", "2026-10-12")).toBe("later");
  });
});
