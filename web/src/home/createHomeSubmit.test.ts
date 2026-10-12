import { describe, expect, it, vi } from "vitest";
import type { Home } from "./api";
import type { ReviewItem } from "../catalog/review";
import { emptyForm } from "../chores/form";
import { createHomeSubmitter, type CreateStatus } from "./createHomeSubmit";
import type { CreateOutcome } from "./createOrLoad";

const home = { timezone: "Europe/Lisbon", allocationTime: "07:00" } as Home;
const item: ReviewItem = { key: 7, catalogId: "dishes", instance: null, form: emptyForm() };

function setup(outcome: CreateOutcome, items: ReviewItem[] = [item]) {
  const create = vi.fn(() => Promise.resolve(outcome));
  const statuses: CreateStatus[] = [];
  const onSaved = vi.fn();
  const onRecovered = vi.fn();
  const onInvalid = vi.fn();
  const submit = createHomeSubmitter({
    create,
    getSettings: () => ({ timezone: "Europe/Lisbon", allocationTime: "07:00" }),
    getItems: () => items,
    onStatus: (status) => statuses.push(status),
    onInvalid,
    onSaved,
    onRecovered,
  });
  return { create, statuses, onSaved, onRecovered, onInvalid, submit };
}

describe("create home submit", () => {
  it("creates one Home for a double click in the same tick", async () => {
    const { create, onSaved, submit } = setup({ kind: "ok", home });
    await Promise.all([submit(), submit()]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("returns to normal after a failure so the retry sends again", async () => {
    const { create, statuses, submit } = setup({ kind: "offline" });
    await submit();
    expect(statuses.at(-1)).toEqual({ kind: "failed", reason: "offline" });
    await submit();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("says the reviewed Chores were dropped when the person already had a Home", async () => {
    const { onRecovered, submit } = setup({ kind: "recovered", home });
    await submit();
    expect(onRecovered).toHaveBeenCalledWith(home, true);
  });

  it("splits the API's field errors between the Home and the reviewed Chores", async () => {
    const { onInvalid, statuses, submit } = setup({
      kind: "invalid",
      fields: { timezone: "unknown", "chores.0.name": "required" },
    });
    await submit();
    expect(statuses.at(-1)).toEqual({ kind: "idle" });
    expect(onInvalid).toHaveBeenCalledWith({
      settings: { timezone: "unknown" },
      byItem: { 7: { name: "required" } },
      tooMany: false,
    });
  });
});
