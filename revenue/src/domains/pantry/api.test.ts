import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { addItem, deleteItem, getPantry, markRanOut, undoRanOut, updateItem } from "./api";

const ITEM = { id: "p1", name: "Arroz", preferredBrand: "Tio João", fixed: true, state: "in_stock", ranOutOn: null };

function setup(status: number, data: unknown, fail = false) {
  const store = createSessionStore({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  store.save({ idToken: "id", refreshToken: "r", expiresAt: Date.now() + 3_600_000 });
  const sent: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    sent.push(config);
    if (fail) throw new Error("offline");
    return { data, status, statusText: "", headers: {}, config };
  };
  const client = createApiClient({ baseUrl: "http://api.test", session: store, refresh: async () => ({ kind: "error" }), now: Date.now, adapter });
  return { client, sent };
}

describe("getPantry", () => {
  it("reads the items, defaulting a brand and a run-out day the API leaves out", async () => {
    const out = { id: "p2", name: "Leite", fixed: false, state: "ran_out", ranOutOn: "2030-01-08" };
    const { client, sent } = setup(200, { items: [ITEM, out] });
    expect(await getPantry(client)).toEqual([ITEM, { ...out, preferredBrand: null }]);
    expect(sent[0]!.url).toBe("/me/finance/pantry");
  });

  it("throws on a failure status and on a malformed body", async () => {
    await expect(getPantry(setup(503, { items: [] }).client)).rejects.toThrow();
    await expect(getPantry(setup(200, []).client)).rejects.toThrow();
  });

  it.each([
    ["id", 1], ["name", null], ["fixed", "yes"], ["state", "running_low"], ["preferredBrand", 5], ["ranOutOn", 20300108],
  ])("refuses a bad %s", async (field, value) => {
    await expect(getPantry(setup(200, { items: [{ ...ITEM, [field]: value }] }).client)).rejects.toThrow();
  });
});

describe("writes", () => {
  it("POSTs a new item and expects 201", async () => {
    const { client, sent } = setup(201, ITEM);
    expect(await addItem("Arroz", null, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/pantry/items");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ name: "Arroz", preferredBrand: null });
  });

  it("turns a 409 name_taken into a field error on the name, and any other 409 into an error", async () => {
    expect(await addItem("Arroz", null, setup(409, { error: "name_taken" }).client)).toEqual({ kind: "fields", fields: { name: "taken" } });
    expect(await updateItem("p1", { name: "Arroz" }, setup(409, { error: "name_taken" }).client)).toEqual({ kind: "fields", fields: { name: "taken" } });
    expect(await addItem("Arroz", null, setup(409, { error: "other" }).client)).toEqual({ kind: "error" });
  });

  it("PATCHes the encoded id with only the fields given, a null brand clearing it", async () => {
    const { client, sent } = setup(200, ITEM);
    expect(await updateItem("a/b", { preferredBrand: null, fixed: true }, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("patch");
    expect(sent[0]!.url).toBe("/me/finance/pantry/items/a%2Fb");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ preferredBrand: null, fixed: true });
  });

  it("maps 404 and a failure on each write", async () => {
    for (const write of [(c: Parameters<typeof deleteItem>[1]) => deleteItem("p1", c), (c: Parameters<typeof deleteItem>[1]) => markRanOut("p1", c), (c: Parameters<typeof deleteItem>[1]) => undoRanOut("p1", c)]) {
      expect(await write(setup(404, {}).client)).toEqual({ kind: "not-found" });
      expect(await write(setup(500, {}).client)).toEqual({ kind: "error" });
      expect(await write(setup(204, null, true).client)).toEqual({ kind: "error" });
    }
  });

  it("DELETEs the item, POSTs a run-out and DELETEs the latest one, each expecting 204", async () => {
    const { client, sent } = setup(204, null);
    expect(await deleteItem("p1", client)).toEqual({ kind: "ok" });
    expect(await markRanOut("p1", client)).toEqual({ kind: "ok" });
    expect(await undoRanOut("p1", client)).toEqual({ kind: "ok" });
    expect(sent.map((s) => `${s.method} ${s.url}`)).toEqual([
      "delete /me/finance/pantry/items/p1",
      "post /me/finance/pantry/items/p1/run-outs",
      "delete /me/finance/pantry/items/p1/run-outs/latest",
    ]);
  });

  it("counts a 409 not_ran_out on undo as done", async () => {
    expect(await undoRanOut("p1", setup(409, { error: "not_ran_out" }).client)).toEqual({ kind: "ok" });
    expect(await undoRanOut("p1", setup(409, { error: "other" }).client)).toEqual({ kind: "error" });
  });
});
