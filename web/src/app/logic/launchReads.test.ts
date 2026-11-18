import { describe, expect, it } from "vitest";
import { refetchUnlessSucceeded } from "../../shared/query/queryClient";
import { launchReads } from "./launchReads";

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
