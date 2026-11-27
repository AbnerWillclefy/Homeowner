import { describe, expect, it } from "vitest";
import { pairsHome } from "./data";

describe("pairsHome", () => {
  it("is the artboards' household: 14 Chores in 10 Categories, Abner and Ana", () => {
    const state = pairsHome();
    expect(state.chores).toHaveLength(14);
    expect(new Set(state.chores.map((c) => c.category)).size).toBe(10);
    expect(state.user).toMatchObject({ displayName: "Abner", email: "abner@exemplo.com" });
    expect(state.residents?.find((r) => r.you)).toMatchObject({ name: "Abner", streak: 6, doneToday: 1 });
    expect(state.residents?.find((r) => r.name === "Ana")).toMatchObject({ streak: 11, doneToday: 2 });
    expect(state.checkIn).toMatchObject({ checkedIn: true, level: "low" });
    expect(state.streakTodayGrew).toBe(false);
  });

  it("carries louça's last Completion (Ana, yesterday), the week and the commands left", () => {
    const state = pairsHome();
    expect(state.dayPlan?.mine.find((t) => t.choreId === "louca")?.lastDone).toEqual({ date: "2030-01-14", residentIds: ["resident-2"] });
    expect(state.streakWeek?.map((d) => d.state)).toEqual(["grew", "grew", "grew", "paused", "grew", "grew", "open"]);
    expect(state.streakWeek?.map((d) => d.date)[0]).toBe("2030-01-09");
    expect(state.voiceRemaining).toBe(4);
  });

  it("gives the Responsible Chores their Residents and the Demands their ids", () => {
    const byName = (name: string) => pairsHome().chores.find((c) => c.name === name);
    expect(byName("Limpar a pia do banheiro")?.responsibleResidentId).toBe("resident-1");
    expect(byName("Aspirar a sala")?.responsibleResidentId).toBe("resident-2");
    expect(byName("Limpar o box")?.demands).toEqual(["strong_chemicals"]);
    expect(byName("Passar pano no chão")?.demands).toEqual(["bending"]);
  });

  it("has an empty `mine` and a streak of 7 that grew today for `done`", () => {
    const state = pairsHome("done");
    expect(state.dayPlan?.mine).toEqual([]);
    expect([state.streak, state.streakTodayGrew]).toEqual([7, true]);
    expect(state.streakWeek?.map((d) => d.state)).toEqual(["grew", "grew", "grew", "paused", "grew", "grew", "grew"]);
  });

  it("keeps the default household for `loading` and `offline`", () => {
    for (const data of ["loading", "offline"] as const) expect(pairsHome(data).dayPlan?.mine.length, data).toBeGreaterThan(0);
  });

  it("leaves `joined` false on the onboarding pairs, so they count 'de 5'", () => {
    expect(pairsHome("onboarding", "home").joined ?? false).toBe(false);
  });
});
