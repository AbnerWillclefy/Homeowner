import { describe, expect, it } from "vitest";
import { withReport } from "./loadingReports";

describe("withReport", () => {
  it("adds a section that starts loading", () => {
    expect([...withReport(new Set(), "a", true)]).toEqual(["a"]);
  });

  it("removes a section that finished", () => {
    expect([...withReport(new Set(["a", "b"]), "a", false)]).toEqual(["b"]);
  });

  it("keeps the same set when nothing changes, so no re-render follows", () => {
    const loading = new Set(["a"]);
    expect(withReport(loading, "a", true)).toBe(loading);
    expect(withReport(loading, "b", false)).toBe(loading);
  });

  it("does not change the set it was given", () => {
    const loading: ReadonlySet<string> = new Set(["a"]);
    withReport(loading, "b", true);
    expect([...loading]).toEqual(["a"]);
  });
});
