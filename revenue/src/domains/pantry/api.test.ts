import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { addItem, addReceipt, deleteItem, editListItem, getItem, getList, getPantry, markRanOut, matchLine, readPhoto, saveDraft, undoRanOut, updateItem } from "./api";

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

describe("the Pantry read's price and duration", () => {
  it("passes lastPriceCents and avgDurationDays through when the API sends them", async () => {
    const rich = { ...ITEM, lastPriceCents: 2790, avgDurationDays: 22 };
    expect(await getPantry(setup(200, { items: [rich] }).client)).toEqual([rich]);
  });

  it.each([["lastPriceCents", "27,90"], ["lastPriceCents", 27.9], ["avgDurationDays", null], ["avgDurationDays", "22"]])("refuses a row with a bad %s (%j)", async (field, value) => {
    await expect(getPantry(setup(200, { items: [{ ...ITEM, [field]: value }] }).client)).rejects.toThrow();
  });
});

const PRICE = { issuedOn: "2030-01-02", unitPriceCents: 2790, storeName: "Bom Preço" };
const DETAIL = { item: ITEM, avgDurationDays: 22, prices: [PRICE, { ...PRICE, issuedOn: "2029-12-01", unitPriceCents: 2400 }] };

describe("getItem", () => {
  it("GETs the encoded item and reads its average and prices as sent", async () => {
    const { client, sent } = setup(200, DETAIL);
    expect(await getItem("a/b", client)).toEqual({ kind: "ok", detail: DETAIL });
    expect(sent[0]!.url).toBe("/me/finance/pantry/items/a%2Fb");
  });

  it("reads a missing average as null, and no purchases as an empty list", async () => {
    const { avgDurationDays: _, ...bare } = DETAIL;
    expect(await getItem("p1", setup(200, { ...bare, prices: [] }).client)).toEqual({ kind: "ok", detail: { item: ITEM, avgDurationDays: null, prices: [] } });
  });

  it("answers not-found for 404 and throws for any other failure", async () => {
    expect(await getItem("p1", setup(404, {}).client)).toEqual({ kind: "not-found" });
    await expect(getItem("p1", setup(500, {}).client)).rejects.toThrow();
    await expect(getItem("p1", setup(200, DETAIL, true).client)).rejects.toThrow();
  });

  it.each([
    ["item", "p1"], ["avgDurationDays", "22"], ["avgDurationDays", 2.5], ["prices", "none"], ["prices", [null]],
  ])("refuses a body with a bad %s", async (field, value) => {
    await expect(getItem("p1", setup(200, { ...DETAIL, [field]: value }).client)).rejects.toThrow();
  });

  it.each([
    ["issuedOn", 20300102], ["unitPriceCents", "27,90"], ["unitPriceCents", 1.5], ["storeName", null],
  ])("refuses a price with a bad %s", async (field, value) => {
    await expect(getItem("p1", setup(200, { ...DETAIL, prices: [{ ...PRICE, [field]: value }] }).client)).rejects.toThrow();
  });
});

describe("photo receipts", () => {
  const DRAFT = { storeName: "Bom Preço", issuedOn: "2030-01-02", totalCents: 2790, lines: [{ description: "Arroz", quantityMilli: 1000, unit: "UN", unitPriceCents: 2790, totalCents: 2790 }] };
  const RECEIPT = { id: "r1", storeName: "Bom Preço", issuedOn: "2030-01-02", totalCents: 2790, readBy: "photo", lines: [{ n: 1, ...DRAFT.lines[0], itemId: null, ignored: false }] };

  it("sends the photo as the raw JPEG body and reads the draft, defaulting the optional fields", async () => {
    const photo = new Blob(["x"], { type: "image/jpeg" });
    const { client, sent } = setup(200, { draft: DRAFT });
    expect(await readPhoto(photo, client)).toEqual({ kind: "draft", draft: { ...DRAFT, storeCnpj: "", accessKey: "" } });
    expect(sent[0]!.url).toBe("/me/finance/pantry/receipts/photo");
    expect(sent[0]!.data).toBe(photo);
    expect(sent[0]!.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it.each([
    [429, { error: "photo_cap" }, "cap"],
    [502, { error: "photo_unreadable" }, "unreadable"],
    [413, { error: "too_large" }, "error"],
    [415, { error: "unsupported_media_type" }, "error"],
    [503, {}, "error"],
  ])("maps %d to %s", async (status, body, kind) => {
    expect((await readPhoto(new Blob(["x"]), setup(status, body).client)).kind).toBe(kind);
  });

  it("is an error when the request fails", async () => {
    expect((await readPhoto(new Blob(["x"]), setup(200, {}, true).client)).kind).toBe("error");
  });

  it.each([
    ["storeName", 5], ["issuedOn", null], ["totalCents", "10"], ["lines", {}], ["storeCnpj", 1], ["accessKey", 1],
    ["lines", [{ ...DRAFT.lines[0], quantityMilli: 1.5 }]], ["lines", [{ ...DRAFT.lines[0], description: 1 }]], ["lines", [{ ...DRAFT.lines[0], unit: null }]],
    ["lines", [{ ...DRAFT.lines[0], unitPriceCents: "1" }]], ["lines", [{ ...DRAFT.lines[0], totalCents: undefined }]], ["lines", [null]],
  ])("refuses a draft with a bad %s", async (field, value) => {
    expect((await readPhoto(new Blob(["x"]), setup(200, { draft: { ...DRAFT, [field]: value } }).client)).kind).toBe("error");
  });

  it("saves a draft as { draft } and tells created from duplicate", async () => {
    const created = setup(201, RECEIPT);
    expect(await saveDraft({ ...DRAFT, storeCnpj: "", accessKey: "" }, created.client)).toMatchObject({ kind: "created", receipt: { readBy: "photo" } });
    expect(created.sent[0]!.url).toBe("/me/finance/pantry/receipts");
    expect(JSON.parse(String(created.sent[0]!.data))).toEqual({ draft: { ...DRAFT, storeCnpj: "", accessKey: "" } });
    expect((await saveDraft({ ...DRAFT, storeCnpj: "", accessKey: "" }, setup(200, RECEIPT).client)).kind).toBe("duplicate");
  });

  it("returns the fields a 400 invalid_draft names, and an error for anything else", async () => {
    const d = { ...DRAFT, storeCnpj: "", accessKey: "" };
    expect(await saveDraft(d, setup(400, { error: "invalid_draft", fields: ["totalCents", "lines.2.description", 7] }).client)).toEqual({ kind: "rejected", fields: ["totalCents", "lines.2.description"] });
    expect((await saveDraft(d, setup(400, { error: "other" }).client)).kind).toBe("error");
    expect((await saveDraft(d, setup(201, { id: "r1" }).client)).kind).toBe("error");
    expect((await saveDraft(d, setup(500, {}).client)).kind).toBe("error");
  });
});

const LIST_LINE = { itemId: "p1", name: "Arroz", preferredBrand: null, fixed: true, quantityMilli: 2000, unit: "UN", unitPriceCents: 2790, priceCents: 5580 };

describe("getList", () => {
  it("reads priced and unpriced lines, the total and the groceries left", async () => {
    const unpriced = { itemId: "p2", name: "Sal", preferredBrand: "Cisne", fixed: false, quantityMilli: 1000, unit: "UN" };
    const { client, sent } = setup(200, { items: [LIST_LINE, unpriced], expectedTotalCents: 5580, groceriesLeftCents: -200 });
    expect(await getList(client)).toEqual({ items: [LIST_LINE, unpriced], expectedTotalCents: 5580, groceriesLeftCents: -200 });
    expect(sent[0]!.url).toBe("/me/finance/pantry/list");
  });

  it("leaves the groceries left out with no limit, and reads a null brand as none", async () => {
    const { client } = setup(200, { items: [{ ...LIST_LINE, preferredBrand: undefined }], expectedTotalCents: 5580 });
    const list = await getList(client);
    expect("groceriesLeftCents" in list).toBe(false);
    expect(list.items[0]!.preferredBrand).toBeNull();
  });

  it("throws on a failure status and on a malformed body", async () => {
    await expect(getList(setup(503, {}).client)).rejects.toThrow();
    await expect(getList(setup(200, []).client)).rejects.toThrow();
  });

  it.each([
    ["itemId", 1], ["name", null], ["fixed", "yes"], ["quantityMilli", 1.5], ["quantityMilli", 0], ["unit", 1], ["preferredBrand", 5], ["unitPriceCents", "1"], ["priceCents", 1.5],
  ])("refuses a bad line %s", async (field, value) => {
    await expect(getList(setup(200, { items: [{ ...LIST_LINE, [field]: value }], expectedTotalCents: 0 }).client)).rejects.toThrow();
  });

  it.each([["expectedTotalCents", "1"], ["groceriesLeftCents", 1.5], ["items", null]])("refuses a bad %s", async (field, value) => {
    await expect(getList(setup(200, { items: [LIST_LINE], expectedTotalCents: 5580, [field]: value }).client)).rejects.toThrow();
  });
});

describe("editListItem", () => {
  it("puts a quantity or a removal and answers ok on a 204", async () => {
    const { client, sent } = setup(204, "");
    expect(await editListItem("p 1", { quantityMilli: 3000 }, client)).toEqual({ kind: "ok" });
    expect(await editListItem("p1", { removed: true }, client)).toEqual({ kind: "ok" });
    expect(sent.map((r) => [r.method, r.url, r.data])).toEqual([
      ["put", "/me/finance/pantry/list/p%201", '{"quantityMilli":3000}'],
      ["put", "/me/finance/pantry/list/p1", '{"removed":true}'],
    ]);
  });

  it("tells a missing item and a failure apart", async () => {
    expect(await editListItem("p1", { removed: true }, setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await editListItem("p1", { removed: true }, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await editListItem("p1", { removed: true }, setup(204, "", true).client)).toEqual({ kind: "error" });
  });
});
