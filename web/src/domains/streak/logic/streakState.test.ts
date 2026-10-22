import { describe, expect, it } from "vitest";
import type { Streak } from "../api/api";
import { streakStateOf, type StreakSnapshot } from "./streakState";

const STREAK: Streak = { current: 4, todayGrew: true };
const snapshot = (over: Partial<StreakSnapshot>): StreakSnapshot => ({
  data: undefined,
  isPending: true,
  fetchStatus: "fetching",
  ...over,
});

describe("streakStateOf", () => {
  it("is loading with no Streak until the first answer", () => {
    expect(streakStateOf(snapshot({}))).toEqual({ streak: null, loading: true });
  });

  it("ends loading with the Streak on the first answer", () => {
    expect(streakStateOf(snapshot({ data: STREAK, isPending: false, fetchStatus: "idle" }))).toEqual({
      streak: STREAK,
      loading: false,
    });
  });

  it("ends loading with no Streak when the first answer failed or the caller has no Home", () => {
    expect(streakStateOf(snapshot({ isPending: false, fetchStatus: "idle" }))).toEqual({ streak: null, loading: false });
    expect(streakStateOf(snapshot({ data: null, isPending: false, fetchStatus: "idle" }))).toEqual({
      streak: null,
      loading: false,
    });
  });

  it("never loads again on a refetch, and keeps the last number when it fails", () => {
    expect(streakStateOf(snapshot({ data: STREAK, isPending: false, fetchStatus: "fetching" }))).toEqual({
      streak: STREAK,
      loading: false,
    });
  });

  it("is not loading when the query is idle without data (a paused or disabled query shows no skeleton)", () => {
    expect(streakStateOf(snapshot({ fetchStatus: "idle" }))).toEqual({ streak: null, loading: false });
  });
});
