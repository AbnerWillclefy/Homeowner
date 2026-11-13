import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { deleteBill, dismissBillSuggestion, getBills, getBillSuggestions, getCardBills, saveBill, setBillPaid } from "./api";

const BILL = { id: "b1", name: "Aluguel", expectedCents: 320000, dueDay: 5, dueDate: "2030-01-05", paid: false, paidBy: null, paidCents: null };

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

describe("getBills", () => {
  it("reads the month's Bills, defaulting what an older API leaves out", async () => {
    const { client, sent } = setup(200, [{ ...BILL, paidBy: undefined, paidCents: undefined }]);
    expect(await getBills("2030-01", client)).toEqual([BILL]);
    expect(sent[0]!.url).toBe("/me/finance/bills");
    expect(sent[0]!.params).toEqual({ month: "2030-01" });
  });

  it("throws on a failure status and on a malformed body", async () => {
    await expect(getBills("2030-01", setup(503, []).client)).rejects.toThrow();
    await expect(getBills("2030-01", setup(200, { bills: [] }).client)).rejects.toThrow();
    await expect(getBills("2030-01", setup(200, [{ id: 1 }]).client)).rejects.toThrow();
    await expect(getBills("2030-01", setup(200, [{ ...BILL, paidBy: "magic" }]).client)).rejects.toThrow();
  });
});

describe("saveBill", () => {
  const input = { name: "Aluguel", expectedCents: 320000, dueDay: 5 };

  it("POSTs a new Bill and expects 201", async () => {
    const { client, sent } = setup(201, {});
    expect(await saveBill(null, input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/bills");
    expect(JSON.parse(String(sent[0]!.data))).toEqual(input);
  });

  it("PUTs an edit to the encoded id and expects 200", async () => {
    const { client, sent } = setup(200, {});
    expect(await saveBill("b/1", input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/bills/b%2F1");
  });

  it("hands a 400's field codes back to the form", async () => {
    expect(await saveBill(null, input, setup(400, { fields: { name: "required", dueDay: "invalid", x: 1 } }).client)).toEqual({
      kind: "fields",
      fields: { name: "required", dueDay: "invalid" },
    });
  });

  it("is an error for a 400 without fields, another status, a network failure", async () => {
    expect(await saveBill(null, input, setup(400, "nope").client)).toEqual({ kind: "error" });
    expect(await saveBill(null, input, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await saveBill(null, input, setup(200, {}).client)).toEqual({ kind: "error" });
    expect(await saveBill(null, input, setup(0, {}, true).client)).toEqual({ kind: "error" });
  });

  it("names a missing Bill", async () => {
    expect(await saveBill("b1", input, setup(404, {}).client)).toEqual({ kind: "not-found" });
  });
});

describe("deleteBill", () => {
  it("DELETEs and expects 204", async () => {
    const { client, sent } = setup(204, "");
    expect(await deleteBill("b1", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("delete");
    expect(sent[0]!.url).toBe("/me/finance/bills/b1");
  });
  it("names a missing Bill and reports other failures", async () => {
    expect(await deleteBill("b1", setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await deleteBill("b1", setup(500, {}).client)).toEqual({ kind: "error" });
  });
});

describe("setBillPaid", () => {
  it("PUTs the payment for the month, and DELETEs it to undo", async () => {
    const paid = setup(204, "");
    expect(await setBillPaid("b1", "2030-01", true, paid.client)).toEqual({ kind: "ok" });
    expect([paid.sent[0]!.method, paid.sent[0]!.url]).toEqual(["put", "/me/finance/bills/b1/payments/2030-01"]);
    const undo = setup(204, "");
    expect(await setBillPaid("b1", "2030-01", false, undo.client)).toEqual({ kind: "ok" });
    expect(undo.sent[0]!.method).toBe("delete");
  });
  it("reports a refusal", async () => {
    expect(await setBillPaid("b1", "2030-01", true, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await setBillPaid("b1", "2030-01", true, setup(0, {}, true).client)).toEqual({ kind: "error" });
  });
});

describe("suggestions", () => {
  const S = { merchantKey: "enel", name: "Enel", amountCents: 21480, dueDay: 10 };
  it("reads them, keeping only the fields the screen uses", async () => {
    expect(await getBillSuggestions(setup(200, [{ ...S, extra: 1 }]).client)).toEqual([S]);
  });
  it("throws on a suggestion with a bad day or amount", async () => {
    await expect(getBillSuggestions(setup(200, [{ ...S, dueDay: 32 }]).client)).rejects.toThrow();
    await expect(getBillSuggestions(setup(200, [{ ...S, amountCents: 0 }]).client)).rejects.toThrow();
  });
  it("dismisses by merchant key", async () => {
    const { client, sent } = setup(204, "");
    expect(await dismissBillSuggestion("enel", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.url).toBe("/me/finance/bill-suggestions/dismissals");
    expect(JSON.parse(String(sent[0]!.data))).toEqual({ merchantKey: "enel" });
  });
});

describe("getCardBills", () => {
  const CARD = { sourceId: "s1", name: "Nubank", amountCents: 284300, billDaysKnown: true };
  it("reads the cards of the month asked for", async () => {
    const body = { months: [{ month: "2030-01", cards: [{ ...CARD, extra: 1 }] }, { month: "2030-02", cards: [] }] };
    const { client, sent } = setup(200, body);
    expect(await getCardBills("2030-01", client)).toEqual([CARD]);
    expect(sent[0]!.params).toEqual({ from: "2030-01" });
  });
  it("throws when the month is missing or a card is malformed", async () => {
    await expect(getCardBills("2030-01", setup(200, { months: [] }).client)).rejects.toThrow();
    await expect(getCardBills("2030-01", setup(200, { months: [{ month: "2030-01", cards: [{ name: 1 }] }] }).client)).rejects.toThrow();
    await expect(getCardBills("2030-01", setup(500, {}).client)).rejects.toThrow();
  });
});
