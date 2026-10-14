import { describe, expect, it, vi } from "vitest";
import type { Home } from "../api/api";
import { createSettingsSubmitter, type FormStatus, type SaveOutcome } from "./settingsSubmit";

const home = { timezone: "Europe/Lisbon", allocationTime: "07:00" } as Home;

function setup(outcome: SaveOutcome) {
  const save = vi.fn(() => Promise.resolve(outcome));
  const statuses: FormStatus[] = [];
  const onSaved = vi.fn();
  const onRecovered = vi.fn();
  const submit = createSettingsSubmitter({
    save,
    getValues: () => ({ timezone: "Europe/Lisbon", allocationTime: "07:00" }),
    onStatus: (status) => statuses.push(status),
    onSaved,
    onRecovered,
  });
  return { save, statuses, onSaved, onRecovered, submit };
}

describe("home settings submit", () => {
  it("sends one request for a double click or double Enter in the same tick", async () => {
    const { save, onSaved, submit } = setup({ kind: "ok", home });
    await Promise.all([submit(), submit()]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("allows a new submit once the response has returned", async () => {
    const { save, submit } = setup({ kind: "ok", home });
    await submit();
    await submit();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("returns to normal after a failure so the retry sends again", async () => {
    const { save, statuses, submit } = setup({ kind: "error" });
    await submit();
    expect(statuses.at(-1)).toEqual({ kind: "failed", reason: "error" });
    await submit();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("reports field errors as invalid", async () => {
    const { statuses, submit } = setup({ kind: "invalid", fields: { timezone: "unknown" } });
    await submit();
    expect(statuses.at(-1)).toEqual({ kind: "invalid", fields: { timezone: "unknown" } });
  });

  it("hands a recovered Home to onRecovered, not onSaved", async () => {
    const { onSaved, onRecovered, submit } = setup({ kind: "recovered", home });
    await submit();
    expect(onRecovered).toHaveBeenCalledWith(home);
    expect(onSaved).not.toHaveBeenCalled();
  });
});
