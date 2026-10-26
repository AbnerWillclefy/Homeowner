import { describe, expect, it } from "vitest";
import { switchTargets } from "./switchTargets";

const where = { pathname: "/ai", search: "?range=7d" };
const both = { staging: "https://s.example.com", production: "https://p.example.com" };

describe("switchTargets", () => {
  it("points staging at production and keeps the path and query", () => {
    expect(switchTargets("staging", both, where)).toEqual([
      { environment: "production", href: "https://p.example.com/ai?range=7d" },
    ]);
  });

  it("points production at staging", () => {
    expect(switchTargets("production", both, where)).toEqual([
      { environment: "staging", href: "https://s.example.com/ai?range=7d" },
    ]);
  });

  it("keeps the target with no href when its URL is not configured", () => {
    expect(switchTargets("staging", {}, where)).toEqual([{ environment: "production", href: null }]);
  });

  it("offers nothing in local unless the map has other entries", () => {
    expect(switchTargets("local", { local: "http://localhost:5174" }, where)).toEqual([]);
    expect(switchTargets("local", both, where).map((t) => t.environment)).toEqual(["staging", "production"]);
  });
});
