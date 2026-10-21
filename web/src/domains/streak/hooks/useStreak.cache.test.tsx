// @vitest-environment jsdom
import { act, createElement, useState } from "react";
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
  let setKey!: (key: string) => void;
  const Probe = () => {
    const [key, set] = useState("a");
    setKey = set;
    useStreak(key);
    return null;
  };
  beforeEach(() => {
    getStreak.mockReset();
  });
  afterEach(() => rendered?.unmount());

  it("reads once on the first render, and again when `reloadKey` changes", async () => {
    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 3, todayGrew: false } });
    const client = createTestQueryClient();
    rendered = renderWithQueryClient(createElement(Probe), client);
    await settle();
    expect(getStreak).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(streakKey)).toEqual({ current: 3, todayGrew: false });

    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 4, todayGrew: true } });
    act(() => setKey("b"));
    await settle();
    expect(getStreak).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(streakKey)).toEqual({ current: 4, todayGrew: true });
  });
});
