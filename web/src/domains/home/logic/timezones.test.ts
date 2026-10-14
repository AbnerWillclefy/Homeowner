import { describe, expect, it } from "vitest";
import { defaultTimezone, timezoneOptions } from "./timezones";

const SUPPORTED = ["America/Sao_Paulo", "Europe/Lisbon", "Asia/Tokyo"];

describe("timezoneOptions", () => {
  it("lists the supported zones", () => {
    expect(timezoneOptions(SUPPORTED)).toEqual(SUPPORTED);
  });

  it("adds the Home's current zone when the browser does not list it, keeping the list sorted", () => {
    expect(timezoneOptions(SUPPORTED, "America/Buenos_Aires")).toEqual([
      "America/Buenos_Aires",
      "America/Sao_Paulo",
      "Asia/Tokyo",
      "Europe/Lisbon",
    ]);
  });

  it("does not repeat a zone already listed", () => {
    expect(timezoneOptions(SUPPORTED, "Asia/Tokyo")).toEqual(SUPPORTED);
  });
});

describe("defaultTimezone", () => {
  it("is the browser's zone when it is in the list", () => {
    expect(defaultTimezone(SUPPORTED, "Europe/Lisbon")).toBe("Europe/Lisbon");
  });

  it("is the first zone when the browser's is missing from the list", () => {
    expect(defaultTimezone(SUPPORTED, "Mars/Olympus")).toBe("America/Sao_Paulo");
    expect(defaultTimezone(SUPPORTED, undefined)).toBe("America/Sao_Paulo");
  });

  it("is empty when there is nothing to choose from", () => {
    expect(defaultTimezone([], "Europe/Lisbon")).toBe("");
  });
});
