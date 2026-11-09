import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChoreWire } from "../../chores/api/api";

const calls = vi.hoisted(() => ({
  createChore: vi.fn(),
  updateChore: vi.fn(),
  acceptTask: vi.fn(),
  takeTask: vi.fn(),
  refuseTask: vi.fn(),
  completeTask: vi.fn(),
}));
vi.mock("../../chores/api/api", () => ({ createChore: calls.createChore, updateChore: calls.updateChore }));
vi.mock("../../dayplan/api/api", () => ({
  acceptTask: calls.acceptTask,
  takeTask: calls.takeTask,
  refuseTask: calls.refuseTask,
  completeTask: calls.completeTask,
}));

import { sendAction } from "./send";

const body: ChoreWire = {
  name: "Water the plants",
  category: "garden",
  demands: [],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [],
  buildsUp: false,
};

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset().mockResolvedValue({ kind: "ok" });
});

describe("sendAction", () => {
  it("creates a Chore with the body", async () => {
    expect(await sendAction({ kind: "create_chore", choreName: "Water the plants", body })).toEqual({ kind: "ok" });
    expect(calls.createChore).toHaveBeenCalledWith(body);
  });

  it("edits a Chore by id with the body", async () => {
    await sendAction({ kind: "edit_chore", choreId: "c1", choreName: "x", changed: ["name"], body });
    expect(calls.updateChore).toHaveBeenCalledWith("c1", body);
  });

  it.each(["accept", "take", "refuse", "complete"] as const)("%s calls its own Task function with the id", async (kind) => {
    await sendAction({ kind, taskId: "t9", choreName: "x" });
    expect(calls[`${kind}Task`]).toHaveBeenCalledWith("t9");
    for (const [name, fn] of Object.entries(calls)) if (name !== `${kind}Task`) expect(fn).not.toHaveBeenCalled();
  });

  it("keeps the raw failure kind and a conflict's code", async () => {
    calls.completeTask.mockResolvedValue({ kind: "conflict", code: "restricted" });
    expect(await sendAction({ kind: "complete", taskId: "t", choreName: "x" })).toEqual({ kind: "failed", reason: "conflict:restricted" });
    calls.createChore.mockResolvedValue({ kind: "invalid", fields: {} });
    expect(await sendAction({ kind: "create_chore", choreName: "x", body })).toEqual({ kind: "failed", reason: "invalid" });
  });

  it("never sends a choice", async () => {
    expect(await sendAction({ kind: "choice" })).toEqual({ kind: "failed", reason: "choice" });
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
  });
});
