import { describe, expect, it } from "vitest";
import { createTestQueryClient } from "../../../shared/query/testing";
import { updateCached } from "../../../shared/query/cacheUpdate";
import type { Profile, WriteResult } from "../api/api";
import { profileKey } from "../api/queries";
import { withBaseline } from "./changes";
import { performChange } from "./performChange";

const SEED: Profile = {
  baseline: { sunday: null, monday: 3, tuesday: 5, wednesday: null, thursday: null, friday: null, saturday: null },
  preferences: {},
  restrictions: [],
};

/** A change wired the way useProfile wires it: apply and revert write the cache, one field each. */
function setup() {
  const client = createTestQueryClient();
  client.setQueryData(profileKey, SEED);
  const inFlight = new Set<string>();
  const read = () => client.getQueryData(profileKey) as Profile;
  const baseline = (day: "monday" | "tuesday", points: number | null, send: () => Promise<WriteResult>) => {
    const before = read().baseline[day] ?? null;
    return performChange(inFlight, {
      key: `baseline:${day}`,
      apply: () => updateCached(client, profileKey, (p: Profile) => withBaseline(p, day, points)),
      revert: () => updateCached(client, profileKey, (p: Profile) => withBaseline(p, day, before)),
      send,
      onSaved: () => undefined,
      onFailed: () => undefined,
    });
  };
  return { baseline, read };
}

describe("a profile change over the cache", () => {
  it("shows at once and is kept when the write is saved", async () => {
    const { baseline, read } = setup();
    let finish!: (r: WriteResult) => void;
    const done = baseline("monday", 8, () => new Promise<WriteResult>((r) => (finish = r)));
    expect(read().baseline.monday).toBe(8);
    finish({ kind: "ok" });
    await done;
    expect(read().baseline.monday).toBe(8);
  });

  it("goes back to the seed for that field when the write fails offline", async () => {
    const { baseline, read } = setup();
    await baseline("monday", 8, () => Promise.resolve({ kind: "offline" }));
    expect(read()).toEqual(SEED);
  });

  it("keeps a second change made to another field while the first is in flight", async () => {
    const { baseline, read } = setup();
    let fail!: (r: WriteResult) => void;
    const first = baseline("monday", 8, () => new Promise<WriteResult>((r) => (fail = r)));
    await baseline("tuesday", 1, () => Promise.resolve({ kind: "ok" }));
    fail({ kind: "offline" });
    await first;
    expect(read()).toEqual({ ...SEED, baseline: { ...SEED.baseline, monday: 3, tuesday: 1 } });
  });
});
