import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { StreakResult } from "./api";

const getStreak = vi.fn<() => Promise<StreakResult>>();
vi.mock("./api", () => ({ getStreak: () => getStreak() }));

const { streakKey, streakQuery } = await import("./queries");

describe("streakQuery", () => {
  beforeEach(() => getStreak.mockReset());

  it("is keyed under the Home", () => {
    expect(streakKey).toEqual(["home", "streak"]);
    expect(streakQuery.queryKey).toEqual(["home", "streak"]);
  });

  it("returns the Streak, a zero included", async () => {
    getStreak.mockResolvedValue({ kind: "ok", streak: { current: 0, todayGrew: false } });
    expect(await createTestQueryClient().fetchQuery(streakQuery)).toEqual({ current: 0, todayGrew: false });
  });

  it("returns none as null data, not an error", async () => {
    getStreak.mockResolvedValue({ kind: "none" });
    const client = createTestQueryClient();
    expect(await client.fetchQuery(streakQuery)).toBeNull();
    expect(client.getQueryData(streakKey)).toBeNull();
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getStreak.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(streakQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
