import { describe, expect, it } from "vitest";
import { bannerFor } from "./healthBanner";

describe("bannerFor", () => {
  it("shows nothing while checking or when healthy", () => {
    expect(bannerFor({ kind: "loading" })).toBeNull();
    expect(bannerFor({ kind: "ok" })).toBeNull();
  });

  it("names the problem when the API is unavailable or unreachable", () => {
    expect(bannerFor({ kind: "unavailable" })).toBe("health.unavailable");
    expect(bannerFor({ kind: "unreachable" })).toBe("health.unreachable");
  });
});
