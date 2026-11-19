import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { addItem, addReceipt, deleteItem, getPantry, markRanOut, matchLine, undoRanOut, updateItem } from "./api";

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

const LINE = { n: 1, description: "ARROZ", quantityMilli: 1000, unit: "UN", unitPriceCents: 2790, totalCents: 2790, itemId: null, ignored: false };
const RECEIPT = { id: "r1", storeName: "Bom Preço", issuedOn: "2030-01-02", totalCents: 2790, readBy: "sefaz", lines: [LINE] };

describe("addReceipt", () => {
  it("POSTs the code and reads 201 as created and 200 as a duplicate", async () => {
    const { client, sent } = setup(201, RECEIPT);
    expect(await addReceipt("3524", client)).toEqual({ kind: "created", receipt: RECEIPT });
    expect(sent[0]!.url).toBe("/me/finance/pantry/receipts");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ code: "3524" });
    expect(await addReceipt("3524", setup(200, RECEIPT).client)).toEqual({ kind: "duplicate", receipt: RECEIPT });
  });

  it("answers invalid for 400 invalid_code, and unavailable for 502 and 422", async () => {
    expect(await addReceipt("x", setup(400, { error: "invalid_code" }).client)).toEqual({ kind: "invalid" });
    expect(await addReceipt("x", setup(502, { error: "sefaz_unavailable" }).client)).toEqual({ kind: "unavailable" });
    expect(await addReceipt("x", setup(422, { error: "unsupported_state" }).client)).toEqual({ kind: "unavailable" });
  });

  it("answers error for any other status, a network failure and a malformed receipt", async () => {
    expect(await addReceipt("x", setup(400, { error: "other" }).client)).toEqual({ kind: "error" });
    expect(await addReceipt("x", setup(503, {}).client)).toEqual({ kind: "error" });
    expect(await addReceipt("x", setup(201, RECEIPT, true).client)).toEqual({ kind: "error" });
    expect(await addReceipt("x", setup(201, { ...RECEIPT, lines: "none" }).client)).toEqual({ kind: "error" });
  });

  it.each([
    ["id", 1], ["storeName", null], ["issuedOn", 20300102], ["totalCents", "1"], ["readBy", null],
  ])("refuses a receipt with a bad %s", async (field, value) => {
    expect(await addReceipt("x", setup(201, { ...RECEIPT, [field]: value }).client)).toEqual({ kind: "error" });
  });

  it.each([
    ["n", 0], ["description", 5], ["quantityMilli", 1.5], ["unit", null], ["unitPriceCents", "9"], ["totalCents", null], ["itemId", 7], ["ignored", "no"],
  ])("refuses a line with a bad %s", async (field, value) => {
    expect(await addReceipt("x", setup(201, { ...RECEIPT, lines: [{ ...LINE, [field]: value }] }).client)).toEqual({ kind: "error" });
  });
});

describe("matchLine", () => {
  it("PUTs the choice to the encoded receipt and line, and returns the receipt", async () => {
    const { client, sent } = setup(200, RECEIPT);
    expect(await matchLine("r/1", 3, { newItem: { name: "Arroz", brand: null } }, client)).toEqual({ kind: "ok", receipt: RECEIPT });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/pantry/receipts/r%2F1/lines/3");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ newItem: { name: "Arroz", brand: null } });
  });

  it("turns 409 name_taken into a name field error, 404 into not-found, anything else into an error", async () => {
    expect(await matchLine("r1", 1, { ignore: true }, setup(409, { error: "name_taken" }).client)).toEqual({ kind: "fields", fields: { name: "taken" } });
    expect(await matchLine("r1", 1, { ignore: true }, setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await matchLine("r1", 1, { ignore: true }, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await matchLine("r1", 1, { ignore: true }, setup(200, { nope: 1 }).client)).toEqual({ kind: "error" });
  });
});
