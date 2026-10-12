import { describe, expect, it, vi } from "vitest";
import type { WriteResult } from "../api/profile";
import { performChange } from "./performChange";

function setup(result: WriteResult = { kind: "ok" }) {
  const inFlight = new Set<string>();
  const change = (key: string, outcome: WriteResult = result) => {
    const send = vi.fn(() => Promise.resolve(outcome));
    const handlers = { apply: vi.fn(), revert: vi.fn(), onSaved: vi.fn(), onFailed: vi.fn() };
    return { send, handlers, done: performChange(inFlight, { key, send, ...handlers }) };
  };
  return { change, inFlight };
}

describe("profile change", () => {
  it("sends one request when the same control changes twice in the same tick", async () => {
    const { change } = setup();
    const first = change("baseline:monday");
    const second = change("baseline:monday");
    await Promise.all([first.done, second.done]);
    expect(first.send).toHaveBeenCalledTimes(1);
    expect(second.send).not.toHaveBeenCalled();
    expect(second.handlers.apply).not.toHaveBeenCalled();
  });

  it("lets two different controls change at the same time", async () => {
    const { change } = setup();
    const monday = change("baseline:monday");
    const kitchen = change("preference:kitchen");
    await Promise.all([monday.done, kitchen.done]);
    expect(monday.send).toHaveBeenCalledTimes(1);
    expect(kitchen.send).toHaveBeenCalledTimes(1);
  });

  it("shows the change at once and reports saved only on ok", async () => {
    const { change } = setup();
    const run = change("restriction:bending");
    expect(run.handlers.apply).toHaveBeenCalledTimes(1);
    await run.done;
    expect(run.handlers.onSaved).toHaveBeenCalledTimes(1);
    expect(run.handlers.revert).not.toHaveBeenCalled();
  });

  it("undoes the change and reports the problem on failure, then allows a retry", async () => {
    const { change, inFlight } = setup();
    const failed = change("baseline:monday", { kind: "offline" });
    await failed.done;
    expect(failed.handlers.revert).toHaveBeenCalledTimes(1);
    expect(failed.handlers.onFailed).toHaveBeenCalledWith("offline");
    expect(failed.handlers.onSaved).not.toHaveBeenCalled();
    expect(inFlight.size).toBe(0);
    const retry = change("baseline:monday");
    await retry.done;
    expect(retry.send).toHaveBeenCalledTimes(1);
  });
});
