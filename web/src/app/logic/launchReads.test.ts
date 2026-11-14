import { describe, expect, it } from "vitest";
import { refetchUnlessSucceeded } from "../../shared/query/queryClient";
import { financeLaunchReads, launchReads } from "./launchReads";

const keysOf = (pathname: string, hasStoredSession: boolean) =>
  launchReads(pathname, hasStoredSession).map((options) => options.queryKey);

const TODAY_KEYS = [
  ["me"],
  ["me", "onboarding"],
  ["home"],
  ["home", "day-plan"],
  ["home", "check-in"],
  ["home", "streak"],
  ["home", "residents"],
  ["demands"],
];

describe("launchReads", () => {
  it("starts the eight reads Today needs when launching on Today with a stored session", () => {
    expect(keysOf("/", true)).toEqual(TODAY_KEYS);
  });

  it.each(["/?x=1", "/#invite=abc", ""])("counts %j as Today", (pathname) => {
    expect(keysOf(pathname, true)).toEqual(TODAY_KEYS);
  });

  it("starts nothing without a stored session", () => {
    expect(launchReads("/", false)).toEqual([]);
  });

  it.each(["/chores", "/home", "/me", "/welcome/home", "/signin", "/home/residents/x"])(
    "starts nothing on %s, even with a stored session",
    (pathname) => {
      expect(launchReads(pathname, true)).toEqual([]);
    },
  );

  it("gives every read the refetch-on-mount rule that skips an entry that already succeeded", () => {
    for (const options of launchReads("/", true)) expect(options.refetchOnMount).toBe(refetchUnlessSucceeded);
  });
});

describe("financeLaunchReads", () => {
  const ok = { status: 200, body: null };
  const keys = (sections: Parameters<typeof financeLaunchReads>[0]) =>
    financeLaunchReads(sections, "2030-01").map((query) => query.queryKey);

  it("starts the five finance reads for the sections the boot carries", () => {
    const sections = {
      "/me/finance": ok,
      "/me/finance/bills?month=2030-01": ok,
      "/me/finance/commitments?from=2030-01": ok,
      "/me/finance/savings": ok,
      "/me/finance/bill-suggestions": ok,
    };
    expect(keys(sections)).toEqual([
      ["me", "finance"],
      ["me", "finance", "bills", "2030-01"],
      ["me", "finance", "commitments", "2030-01"],
      ["me", "finance", "savings"],
      ["me", "finance", "bill-suggestions"],
    ]);
  });

  it("starts none off the allowlist, where the boot leaves them out", () => {
    expect(keys({ "/home": ok })).toEqual([]);
  });

  it("leaves a failed section, and a section of another month, to the tab's own read", () => {
    expect(keys({ "/me/finance": { status: 503, body: null }, "/me/finance/bills?month=2029-12": ok, "/me/finance/savings": ok })).toEqual([
      ["me", "finance", "savings"],
    ]);
  });
});
