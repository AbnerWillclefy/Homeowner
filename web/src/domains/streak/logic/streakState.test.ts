import { describe, expect, it } from "vitest";
import type { StreakResult } from "../api/api";
import { afterStreakAnswer, INITIAL_STREAK_STATE } from "./streakState";

const ok: StreakResult = { kind: "ok", streak: { current: 4, todayGrew: true } };

describe("afterStreakAnswer", () => {
  it("starts loading with no Streak", () => {
    expect(INITIAL_STREAK_STATE).toEqual({ streak: null, loading: true });
  });

  it("ends loading with the Streak on a first ok answer", () => {
    expect(afterStreakAnswer(INITIAL_STREAK_STATE, ok)).toEqual({ streak: { current: 4, todayGrew: true }, loading: false });
  });

  it.each<StreakResult>([{ kind: "none" }, { kind: "not-signed-in" }, { kind: "offline" }, { kind: "error" }])(
    "ends loading with no Streak when the first answer is $kind",
    (failure) => {
      expect(afterStreakAnswer(INITIAL_STREAK_STATE, failure)).toEqual({ streak: null, loading: false });
    },
  );

  it("keeps the last number when a reload fails", () => {
    const shown = afterStreakAnswer(INITIAL_STREAK_STATE, ok);
    expect(afterStreakAnswer(shown, { kind: "offline" })).toEqual(shown);
  });

  it("replaces the number on a later ok answer and never loads again", () => {
    const shown = afterStreakAnswer(INITIAL_STREAK_STATE, ok);
    const next = afterStreakAnswer(shown, { kind: "ok", streak: { current: 5, todayGrew: true } });
    expect(next).toEqual({ streak: { current: 5, todayGrew: true }, loading: false });
  });
});
