import { describe, expect, it } from "vitest";
import { nextTab } from "./nextTab";

const TABS = ["spending", "bills", "settings"] as const;

describe("nextTab", () => {
  it("moves right and wraps to the first", () => {
    expect(nextTab(TABS, "spending", "ArrowRight")).toBe("bills");
    expect(nextTab(TABS, "settings", "ArrowRight")).toBe("spending");
  });
  it("moves left and wraps to the last", () => {
    expect(nextTab(TABS, "bills", "ArrowLeft")).toBe("spending");
    expect(nextTab(TABS, "spending", "ArrowLeft")).toBe("settings");
  });
  it("jumps to the ends", () => {
    expect(nextTab(TABS, "bills", "Home")).toBe("spending");
    expect(nextTab(TABS, "bills", "End")).toBe("settings");
  });
  it("ignores other keys", () => expect(nextTab(TABS, "bills", "Enter")).toBeNull());
});
