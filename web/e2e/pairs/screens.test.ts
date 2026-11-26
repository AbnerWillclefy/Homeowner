import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPENERS } from "./openers";
import { AXE_EXEMPT, changedArtboards, MAX_AXE_EXEMPT, MAX_EXEMPT, OVERFLOW_EXEMPT, SCREENS, STATES } from "./screens";

const ARTBOARD_DIR = new URL("../../../docs/design/homeowner/", import.meta.url);
const DOMAINS_DIR = new URL("../../src/domains/", import.meta.url);
const files = readdirSync(ARTBOARD_DIR).filter((f) => f.endsWith(".dc.html")).map((f) => f.replace(/\.dc\.html$/, ""));
const screens = Object.entries(SCREENS).flatMap(([name, entry]) => ("domains" in entry ? [{ name, ...entry }] : []));

describe("the artboard mapping", () => {
  it("covers every artboard file, and names only files that exist", () => {
    expect(files).toHaveLength(42);
    expect(Object.keys(SCREENS).sort()).toEqual([...files].sort());
  });

  it("gives every state an opener, and uses only known states", () => {
    expect(Object.keys(OPENERS).sort()).toEqual([...STATES].sort());
    const used = screens.flatMap((s) => (s.state ? [s.state] : []));
    expect(used.length).toBeGreaterThan(0);
    for (const state of used) expect(STATES).toContain(state);
  });

  it("names only domain folders that exist", () => {
    expect(screens.length).toBeGreaterThan(0);
    for (const s of screens) {
      expect(s.domains.length, s.name).toBeGreaterThan(0);
      for (const d of s.domains) expect(existsSync(new URL(`${d}/`, DOMAINS_DIR)), `${s.name}: ${d}`).toBe(true);
    }
  });

  it("gives every artboard that has no screen a reason", () => {
    const reasons = Object.values(SCREENS).flatMap((e) => ("none" in e ? [e.none] : []));
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) expect(reason.length).toBeGreaterThan(10);
  });
});

describe("changedArtboards", () => {
  it("selects the screens of each changed domain", () => {
    const picked = changedArtboards(["web/src/domains/streak/components/StreakButton.tsx"]);
    expect(picked).toContain("StreakSheet");
    expect(picked).not.toContain("Chores");
    expect(changedArtboards(["web/src/domains/chores/api/api.ts", "web/src/domains/streak/x.ts"])).toEqual(expect.arrayContaining(["Chores", "ChoreSheet", "StreakSheet"]));
  });

  it("adds the four tabs for the app frame", () => {
    expect(changedArtboards(["web/src/app/components/Shell.tsx"])).toEqual(["Chores", "Home", "Main", "Me"]);
    expect(changedArtboards(["web/src/app/components/Shell.tsx", "web/src/domains/streak/x.ts"])).toEqual(["Chores", "Home", "Main", "Me", "StreakSheet"]);
  });

  it("shoots Main when only shared code changed", () => {
    for (const file of ["web/src/shared/ui/Button.tsx", "web/index.html", "web/public/icon.svg"]) expect(changedArtboards([file]), file).toEqual(["Main"]);
  });

  it("ignores test files and the service worker", () => {
    expect(changedArtboards(["web/src/domains/chores/components/ChoreForm.test.tsx", "web/src/sw.ts", "web/src/swHelpers.ts"])).toEqual(["Main"]);
  });
});

describe("the overflow exemptions", () => {
  it("only shrink: at most the recorded count, and each names an artboard", () => {
    expect(OVERFLOW_EXEMPT.size).toBeLessThanOrEqual(MAX_EXEMPT);
    for (const name of OVERFLOW_EXEMPT) expect(Object.keys(SCREENS)).toContain(name);
  });
});

describe("the axe exemptions", () => {
  it("only shrink: at most the recorded count, and each names an artboard", () => {
    expect(AXE_EXEMPT.size).toBeLessThanOrEqual(MAX_AXE_EXEMPT);
    for (const name of AXE_EXEMPT) expect(Object.keys(SCREENS)).toContain(name);
  });
});
