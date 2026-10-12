import { describe, expect, it } from "vitest";
import { homeView } from "./homeView";

const home = { id: "h1", timezone: "UTC", allocationTime: "06:00" };

describe("homeView", () => {
  it("is loading while loading", () => {
    expect(homeView({ kind: "loading" }, false)).toBe("loading");
  });

  it.each(["offline", "error", "not-signed-in"] as const)("is failed for %s", (reason) => {
    expect(homeView({ kind: "failed", reason }, false)).toBe("failed");
  });

  it("offers to create a Home when there is none", () => {
    expect(homeView({ kind: "none" }, false)).toBe("create");
  });

  it("does not offer to create while an Invite is pending", () => {
    expect(homeView({ kind: "none" }, true)).toBe("loading");
  });

  it("is ready with a Home, pending Invite or not", () => {
    expect(homeView({ kind: "ready", home }, false)).toBe("ready");
    expect(homeView({ kind: "ready", home }, true)).toBe("ready");
  });
});
