import { beforeEach, describe, expect, it } from "vitest";
import { CHECKED_KEY, clearChecked, readChecked, writeChecked } from "./checked";

beforeEach(() => localStorage.clear());

describe("check-offs", () => {
  it("reads none when nothing was written, and what was written", () => {
    expect(readChecked()).toEqual([]);
    writeChecked(["p1", "p2"]);
    expect(readChecked()).toEqual(["p1", "p2"]);
  });

  it("reads none from a damaged value and drops non-string entries", () => {
    localStorage.setItem(CHECKED_KEY, "{oops");
    expect(readChecked()).toEqual([]);
    localStorage.setItem(CHECKED_KEY, '["p1", 2, null]');
    expect(readChecked()).toEqual(["p1"]);
  });

  it("clears them", () => {
    writeChecked(["p1"]);
    clearChecked();
    expect(localStorage.getItem(CHECKED_KEY)).toBeNull();
  });
});
