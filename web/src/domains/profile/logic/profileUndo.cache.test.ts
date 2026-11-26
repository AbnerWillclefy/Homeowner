// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import { undoHarness } from "../../../shared/undo/testing";
import { updateCached } from "../../../shared/query/cacheUpdate";
import type { Profile, WriteResult } from "../api/api";
import { categoriesKey, demandsKey, profileKey } from "../api/queries";
import type { useProfile as UseProfile } from "../hooks/useProfile";
import { withBaseline } from "./changes";
import { performChange } from "./performChange";

const putBaseline = vi.fn<(body: Record<string, number | null>) => Promise<WriteResult>>();
const setRestriction = vi.fn<(demand: string, restricted: boolean) => Promise<WriteResult>>();
vi.mock("../api/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  putBaseline: (body: Record<string, number | null>) => putBaseline(body),
  setRestriction: (demand: string, restricted: boolean) => setRestriction(demand, restricted),
}));
const { useProfile } = await import("../hooks/useProfile");

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

describe("Desfazer on a profile change", () => {
  let rendered: Rendered | undefined;
  afterEach(() => rendered?.unmount());

  function mount() {
    const undo = undoHarness();
    const client = createTestQueryClient();
    client.setQueryData(profileKey, SEED);
    client.setQueryData(categoriesKey, ["kitchen"]);
    client.setQueryData(demandsKey, ["heights"]);
    let hook!: ReturnType<typeof UseProfile>;
    const Probe = () => {
      hook = useProfile();
      return null;
    };
    rendered = renderWithQueryClient(undo.wrap(createElement(Probe)), client);
    const read = () => client.getQueryData(profileKey) as Profile;
    return { undo, read, hook: () => hook };
  }
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

  it("writes the previous value for that control only, leaving another control's later change", async () => {
    putBaseline.mockReset().mockResolvedValue({ kind: "ok" });
    const { undo, read, hook } = mount();
    await settle();
    await act(async () => hook().setBaseline("monday", 8));
    await act(async () => hook().setBaseline("tuesday", 4));
    expect(read().baseline).toMatchObject({ monday: 8, tuesday: 4 });

    // The Toast on screen is the last change's (tuesday): Desfazer sends tuesday's old value, monday stays.
    await act(async () => undo.undo(undo.toasts.length - 1));
    expect(putBaseline).toHaveBeenLastCalledWith({ tuesday: 5 });
    expect(read().baseline).toMatchObject({ monday: 8, tuesday: 5 });
  });

  it("says the Responsibilities do not come back when a Restriction is added, and removes it on Desfazer", async () => {
    setRestriction.mockReset().mockResolvedValue({ kind: "ok" });
    const { undo, read, hook } = mount();
    await settle();
    await act(async () => hook().setRestricted("heights", true));
    expect(undo.toasts.at(-1)!.request.messageKey).toBe("profile.restriction.added");
    await act(async () => undo.undo(undo.toasts.length - 1));
    expect(setRestriction).toHaveBeenLastCalledWith("heights", false);
    expect(read().restrictions).toEqual([]);
  });

  it("keeps the old value and shows an error when the write fails", async () => {
    putBaseline.mockReset().mockResolvedValue({ kind: "offline" });
    const { undo, read, hook } = mount();
    await settle();
    await act(async () => hook().setBaseline("monday", 8));
    expect(read().baseline.monday).toBe(3);
    expect(undo.toasts.at(-1)!.request).toMatchObject({ messageKey: "profile.saveFailed", tone: "error" });
  });
});
