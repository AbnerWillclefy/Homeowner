// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithQueryClient, type Rendered } from "../../../shared/query/testing";
import type { StreakResult } from "../api/api";

const getStreak = vi.fn<() => Promise<StreakResult>>();
vi.mock("../api/api", async (importOriginal) => ({ ...(await importOriginal<object>()), getStreak: () => getStreak() }));

const { streakKey } = await import("../api/queries");
const { useStreak } = await import("./useStreak");

/** Lets the query client's batched notifications (a zero-delay timer) reach React. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

describe("useStreak over the query cache", () => {
  let rendered: Rendered | undefined;
  let hook!: ReturnType<typeof useStreak>;
  const Probe = ({ hasHome }: { hasHome: boolean }) => {
    hook = useStreak(hasHome);
    return null;
  };
  beforeEach(() => {
    getStreak.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("reads once on the first render with a Home, and again when the Streak is invalidated", async () => {
    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 3, todayGrew: false } });
    const client = createTestQueryClient();
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: true }), client);
    await settle();
    expect(getStreak).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(streakKey)).toEqual({ current: 3, todayGrew: false });

    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 4, todayGrew: true } });
    await act(() => client.invalidateQueries({ queryKey: streakKey }));
    await settle();
    expect(getStreak).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(streakKey)).toEqual({ current: 4, todayGrew: true });
  });

  it("does not read until there is a Home, then reads", async () => {
    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 2, todayGrew: false } });
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: false }));
    await settle();
    expect(getStreak).not.toHaveBeenCalled();
    expect(hook.streak).toBeNull();

    rendered.rerender(createElement(Probe, { hasHome: true }));
    await settle();
    expect(getStreak).toHaveBeenCalledTimes(1);
    expect(hook.streak).toEqual({ current: 2, todayGrew: false });
  });

  it("keeps a launch read that answered before the Home, instead of reading it again", async () => {
    const client = createTestQueryClient();
    client.setQueryData(streakKey, { current: 7, todayGrew: true });
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: false }), client);
    rendered.rerender(createElement(Probe, { hasHome: true }));
    await settle();
    expect(getStreak).not.toHaveBeenCalled();
    expect(hook.streak).toEqual({ current: 7, todayGrew: true });
  });

  it("goes back to stale-at-once after that first read, so returning to the app refreshes the number", async () => {
    const client = createTestQueryClient();
    client.setQueryData(streakKey, { current: 7, todayGrew: true });
    rendered = renderWithQueryClient(createElement(Probe, { hasHome: true }), client);
    await settle();
    expect(client.getQueryCache().find({ queryKey: streakKey })!.isStale()).toBe(true);
  });
});
