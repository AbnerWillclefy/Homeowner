import { describe, expect, it, vi } from "vitest";
import type { Chore, RestrictedRefusal, SaveChoreResult, SetResponsibleResult } from "../api/api";
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

describe("chore form submit with a Responsible field", () => {
  const input = { ...emptyForm(), name: "Dishes" };
  const ok = { kind: "ok" } as const;
  const stored = { ...chore, responsibleResidentId: null } as Chore;
  const restricted: RestrictedRefusal = {
    kind: "restricted",
    residentId: "r1",
    restrictedBy: ["lifting"],
    restrictedByChore: false,
  };

  function build(opts: { form: Partial<ReturnType<typeof emptyForm>>; existing?: Chore; save?: SaveChoreResult; set?: SetResponsibleResult }) {
    const calls: string[] = [];
    let values = { ...input, ...opts.form };
    const statuses: ChoreFormStatus[] = [];
    const onSaved = vi.fn();
    const onStored = vi.fn();
    const result = {
      save: opts.save ?? { kind: "ok", chore: stored },
    };
    const set = vi.fn((id: string, resident: string) => (calls.push(`set ${id} ${resident}`), Promise.resolve(opts.set ?? ok)));
    const clear = vi.fn((id: string) => (calls.push(`clear ${id}`), Promise.resolve(ok)));
    const update = vi.fn((id: string) => (calls.push(`update ${id}`), Promise.resolve(result.save)));
    const submit = createChoreSubmitter({
      save: () => (calls.push("save"), Promise.resolve(result.save)),
      getValues: () => values,
      onStatus: (status) => statuses.push(status),
      onSaved,
      onStored,
      responsibility: { existing: opts.existing ?? null, set, clear, update },
    });
    return { calls, statuses, onSaved, onStored, set, submit, edit: (patch: Partial<typeof values>) => (values = { ...values, ...patch }) };
  }

  it("creates the Chore, then makes the Resident responsible, and hands over the saved value", async () => {
    const { calls, onSaved, submit } = build({ form: { responsible: "r1" } });
    await submit();
    expect(calls).toEqual(["save", "set c1 r1"]);
    expect(onSaved.mock.calls[0]![0].responsibleResidentId).toBe("r1");
  });

  it("makes no responsibility call when creating with Nobody", async () => {
    const { calls, onSaved, submit } = build({ form: { responsible: "" } });
    await submit();
    expect(calls).toEqual(["save"]);
    expect(onSaved.mock.calls[0]![0].responsibleResidentId).toBeNull();
  });

  it("makes no responsibility call when editing with the field untouched", async () => {
    const existing = { ...stored, responsibleResidentId: "r1" };
    const { calls, onSaved, submit } = build({ form: { responsible: "r1" }, existing, save: { kind: "ok", chore: existing } });
    await submit();
    expect(calls).toEqual(["save"]);
    expect(onSaved.mock.calls[0]![0].responsibleResidentId).toBe("r1");
  });

  it("clears the Resident before saving the Chore when Nobody is chosen", async () => {
    const existing = { ...stored, responsibleResidentId: "r1" };
    const { calls, onSaved, submit } = build({ form: { responsible: "" }, existing, save: { kind: "ok", chore: existing } });
    await submit();
    expect(calls).toEqual(["clear c1", "save"]);
    expect(onSaved.mock.calls[0]![0].responsibleResidentId).toBeNull();
  });

  it("changes to another Resident before saving the Chore", async () => {
    const existing = { ...stored, responsibleResidentId: "r1" };
    const { calls, submit } = build({ form: { responsible: "r2" }, existing, save: { kind: "ok", chore: existing } });
    await submit();
    expect(calls).toEqual(["set c1 r2", "save"]);
  });

  it("shows the refusal, saves nothing else and keeps the form's values when the Resident is refused on an edit", async () => {
    const existing = { ...stored, responsibleResidentId: null };
    const { calls, statuses, onSaved, submit } = build({ form: { responsible: "r1" }, existing, set: restricted });
    await submit();
    expect(calls).toEqual(["set c1 r1"]);
    expect(statuses.at(-1)).toEqual(restricted);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("does not post a second Chore when the retry follows a refused create", async () => {
    const built = build({ form: { responsible: "r1" }, set: restricted });
    await built.submit();
    expect(built.calls).toEqual(["save", "set c1 r1"]);
    expect(built.statuses.at(-1)).toEqual(restricted);
    expect(built.onStored).toHaveBeenCalledWith(stored);
    expect(built.onSaved).not.toHaveBeenCalled();

    built.edit({ responsible: "" });
    await built.submit();
    expect(built.calls).toEqual(["save", "set c1 r1", "update c1"]);
    expect(built.onSaved).toHaveBeenCalledTimes(1);
  });

  it("retries only the PUT when the Resident was changed and the fields were refused", async () => {
    const existing = { ...stored, responsibleResidentId: "r1" };
    const built = build({
      form: { responsible: "r2" },
      existing,
      save: { kind: "restricted", residentId: "r2", restrictedBy: ["lifting"], restrictedByChore: false },
    });
    await built.submit();
    expect(built.statuses.at(-1)).toMatchObject({ kind: "restricted" });
    expect(built.onStored).toHaveBeenCalledWith({ ...existing, responsibleResidentId: "r2" });
    await built.submit();
    expect(built.calls).toEqual(["set c1 r2", "save", "save"]);
  });

  it.each([
    [{ kind: "unknown-resident" }, { kind: "unknown-resident" }],
    [{ kind: "none" }, { kind: "failed", reason: "gone" }],
    [{ kind: "offline" }, { kind: "failed", reason: "offline" }],
  ] as const)("reports a refused responsibility %j as %j", async (refusal, status) => {
    const { statuses, submit } = build({ form: { responsible: "r1" }, set: refusal });
    await submit();
    expect(statuses.at(-1)).toEqual(status);
  });
});
