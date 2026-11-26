import { describe, expect, it } from "vitest";
import type { Home, HomeSettings, UpdateHomeResult } from "../api/api";
import { settingsChange } from "./settingsChange";

const previous: Home = { id: "home-1", timezone: "America/Sao_Paulo", allocationTime: "07:00" };

function setup(result: UpdateHomeResult | ((s: HomeSettings) => UpdateHomeResult) = (s) => ({ kind: "ok", home: { id: "home-1", ...s } })) {
  const sent: HomeSettings[] = [];
  const shown: Home[] = [];
  const update = async (settings: HomeSettings) => {
    sent.push(settings);
    return typeof result === "function" ? result(settings) : result;
  };
  return { sent, shown, deps: { update, show: (home: Home) => shown.push(home) } };
}

describe("settingsChange", () => {
  it("shows the new value, then sends the whole settings with it", async () => {
    const { sent, shown, deps } = setup();
    const change = settingsChange(previous, "allocationTime", "06:45", deps);
    change.apply();
    await change.send();
    expect(sent).toEqual([{ timezone: "America/Sao_Paulo", allocationTime: "06:45" }]);
    expect(shown.map((h) => h.allocationTime)).toEqual(["06:45", "06:45"]);
  });

  it("Desfazer sends the whole previous settings, not a merge into what changed meanwhile", async () => {
    const { sent, deps } = setup();
    const time = settingsChange(previous, "allocationTime", "06:45", deps);
    await time.send();
    // The timezone is changed afterwards; the time's undo must still carry the zone it captured.
    await settingsChange({ ...previous, allocationTime: "06:45" }, "timezone", "Europe/Lisbon", deps).send();
    await time.sendRevert();
    expect(sent.at(-1)).toEqual({ timezone: "America/Sao_Paulo", allocationTime: "07:00" });
  });

  it("revert puts the previous Home back on screen", () => {
    const { shown, deps } = setup();
    settingsChange(previous, "timezone", "Europe/Lisbon", deps).revert();
    expect(shown).toEqual([previous]);
  });

  it("names the refusal's reason for the toast", async () => {
    const refused = setup({ kind: "invalid", fields: { allocationTime: "not_quarter_hour" } });
    const change = settingsChange(previous, "allocationTime", "06:50", refused.deps);
    await change.send();
    expect(change.failedKey).toBe("home.field.allocationTime.not_quarter_hour");
    expect(refused.shown).toEqual([]);

    const offline = setup({ kind: "offline" });
    const again = settingsChange(previous, "allocationTime", "06:45", offline.deps);
    await again.send();
    expect(again.failedKey).toBe("home.settings.offline");

    // A Home that vanished (404) is the generic error: nothing sensible to say but try again.
    const gone = setup({ kind: "none" });
    const vanished = settingsChange(previous, "timezone", "Europe/Lisbon", gone.deps);
    await vanished.send();
    expect(vanished.failedKey).toBe("home.settings.error");
  });
});
