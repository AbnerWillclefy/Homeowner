import { describe, expect, it, vi } from "vitest";
import type { Chore, SaveChoreResult } from "./api";
import { emptyForm } from "./form";
import { createChoreSubmitter, type ChoreFormStatus } from "./choreSubmit";

const chore = { id: "c1", name: "Dishes" } as Chore;

function setup(result: SaveChoreResult) {
  const save = vi.fn(() => Promise.resolve(result));
  const statuses: ChoreFormStatus[] = [];
  const onSaved = vi.fn();
  const submit = createChoreSubmitter({
    save,
    getValues: () => emptyForm(),
    onStatus: (status) => statuses.push(status),
    onSaved,
  });
  return { save, statuses, onSaved, submit };
}

describe("chore form submit", () => {
  it("sends one request for a double click or double Enter in the same tick", async () => {
    const { save, onSaved, submit } = setup({ kind: "ok", chore });
    await Promise.all([submit(), submit()]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("allows a new submit once the response has returned", async () => {
    const { save, submit } = setup({ kind: "ok", chore });
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

  it("reports the API's field errors as invalid", async () => {
    const { statuses, submit } = setup({ kind: "invalid", fields: { name: "required" } });
    await submit();
    expect(statuses.at(-1)).toEqual({ kind: "invalid", fields: { name: "required" } });
  });

  it("goes back to idle before handing over the saved Chore", async () => {
    const { statuses, onSaved, submit } = setup({ kind: "ok", chore });
    await submit();
    expect(statuses).toEqual([{ kind: "saving" }, { kind: "idle" }]);
    expect(onSaved).toHaveBeenCalledWith(chore, emptyForm());
  });
});
