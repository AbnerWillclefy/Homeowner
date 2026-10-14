import { describe, expect, it, vi } from "vitest";
import type { CreateHomeResult, GetHomeResult, Home } from "../api/api";
import { createOrLoad, saveSettings } from "./createOrLoad";

const HOME: Home = { id: "h1", timezone: "Europe/Lisbon", allocationTime: "08:00" };
const SETTINGS = { timezone: "Europe/Lisbon", allocationTime: "08:00" };

function deps(create: CreateHomeResult, get: GetHomeResult = { kind: "ok", home: HOME }) {
  return { createHome: vi.fn(async () => create), getHome: vi.fn(async () => get) };
}

describe("createOrLoad", () => {
  it("returns the new Home without loading anything", async () => {
    const d = deps({ kind: "ok", home: HOME });
    expect(await createOrLoad(SETTINGS, d)).toEqual({ kind: "ok", home: HOME });
    expect(d.createHome).toHaveBeenCalledWith(SETTINGS, []);
    expect(d.getHome).not.toHaveBeenCalled();
  });

  it("sends the reviewed Chores with the settings", async () => {
    const d = deps({ kind: "ok", home: HOME });
    const chore = { name: "Wash up", category: "kitchen", demands: [], baseEffort: 1, importance: "normal", people: 1, intervalDays: 1, allowedWeekdays: [], buildsUp: false };
    await createOrLoad(SETTINGS, d, [chore]);
    expect(d.createHome).toHaveBeenCalledWith(SETTINGS, [chore]);
  });

  it("on a 409 loads the existing Home instead", async () => {
    const d = deps({ kind: "already-resident" });
    expect(await createOrLoad(SETTINGS, d)).toEqual({ kind: "recovered", home: HOME });
    expect(d.getHome).toHaveBeenCalledOnce();
  });

  it("on a 409 whose reload fails, reports that failure so the person can retry", async () => {
    expect(await createOrLoad(SETTINGS, deps({ kind: "already-resident" }, { kind: "offline" }))).toEqual({ kind: "offline" });
    expect(await createOrLoad(SETTINGS, deps({ kind: "already-resident" }, { kind: "none" }))).toEqual({ kind: "error" });
  });

  it("passes invalid and the other failures through", async () => {
    const invalid: CreateHomeResult = { kind: "invalid", fields: { timezone: "unknown" } };
    expect(await createOrLoad(SETTINGS, deps(invalid))).toEqual(invalid);
    expect(await createOrLoad(SETTINGS, deps({ kind: "offline" }))).toEqual({ kind: "offline" });
    expect(await createOrLoad(SETTINGS, deps({ kind: "error" }))).toEqual({ kind: "error" });
  });
});

describe("saveSettings", () => {
  it("returns the saved Home", async () => {
    const update = vi.fn(async () => ({ kind: "ok", home: HOME }) as const);
    expect(await saveSettings(SETTINGS, update)).toEqual({ kind: "ok", home: HOME });
    expect(update).toHaveBeenCalledWith(SETTINGS);
  });

  it("passes invalid and failures through, and treats a vanished Home as an error", async () => {
    const invalid = { kind: "invalid", fields: { timezone: "unknown" } } as const;
    expect(await saveSettings(SETTINGS, async () => invalid)).toEqual(invalid);
    expect(await saveSettings(SETTINGS, async () => ({ kind: "offline" }))).toEqual({ kind: "offline" });
    expect(await saveSettings(SETTINGS, async () => ({ kind: "none" }))).toEqual({ kind: "error" });
  });
});
