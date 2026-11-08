import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_KEY } from "../../auth/logic/session";
import {
  createConnectToken,
  deleteCredentials,
  deleteBill,
  deleteFinanceData,
  getBills,
  getFinanceStatus,
  getMonth,
  patchTransaction,
  putCredentials,
  registerItem,
  saveBill,
  setBillPaid,
} from "./api";

function stubStorage(signedIn: boolean) {
  const data = new Map<string, string>();
  if (signedIn) {
    data.set(SESSION_KEY, JSON.stringify({ idToken: "id-1", refreshToken: "rt-1", expiresAt: Date.now() + 3600_000 }));
  }
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
}

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const STATUS = {
  configured: true,
  sources: [{ id: "s1", name: "Nubank", kind: "checking", currency: "BRL" }],
  importing: false,
  lastSyncedAt: "2026-11-08T10:00:00Z",
};

beforeEach(() => stubStorage(true));
afterEach(() => vi.unstubAllGlobals());

describe("getFinanceStatus", () => {
  it("reads GET /me/finance", async () => {
    const fetch = stubFetch(Response.json(STATUS));
    expect(await getFinanceStatus()).toEqual({ kind: "ok", status: STATUS });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/finance");
  });

  it("reads a status with no sync yet", async () => {
    stubFetch(Response.json({ configured: false, sources: [], importing: false, lastSyncedAt: null }));
    expect(await getFinanceStatus()).toEqual({
      kind: "ok",
      status: { configured: false, sources: [], importing: false, lastSyncedAt: null },
    });
  });

  it("is an error for a body it cannot read", async () => {
    const bodies = [{ ...STATUS, configured: "yes" }, { ...STATUS, sources: [{ id: 1 }] }, { ...STATUS, lastSyncedAt: 5 }, null];
    for (const body of bodies) {
      stubFetch(Response.json(body));
      expect(await getFinanceStatus(), JSON.stringify(body)).toEqual({ kind: "error" });
    }
  });

  it("is offline when the request cannot be made", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await getFinanceStatus()).toEqual({ kind: "offline" });
  });

  it("is not-signed-in without a session", async () => {
    stubStorage(false);
    const fetch = stubFetch(Response.json(STATUS));
    expect(await getFinanceStatus()).toEqual({ kind: "not-signed-in" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("putCredentials", () => {
  it("sends both values in the body of PUT /me/finance/credentials and nowhere else", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await putCredentials("id-x", "secret-y")).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://api.test/me/finance/credentials");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ clientId: "id-x", clientSecret: "secret-y" });
    expect(url).not.toContain("secret-y");
  });

  it("names the failure for each status", async () => {
    const cases: [Response, string][] = [
      [Response.json({ error: "invalid credentials", fields: {} }, { status: 400 }), "invalid"],
      [Response.json({ error: "pluggy_credentials_rejected" }, { status: 422 }), "rejected"],
      [Response.json({ error: "pluggy unavailable" }, { status: 502 }), "unavailable"],
      [new Response("boom", { status: 500 }), "error"],
    ];
    for (const [response, kind] of cases) {
      stubFetch(response);
      expect(await putCredentials("a", "b")).toEqual({ kind });
    }
  });
});

describe("deleteCredentials and deleteFinanceData", () => {
  it("call their routes and accept 204", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await deleteCredentials()).toEqual({ kind: "ok" });
    expect(await deleteFinanceData()).toEqual({ kind: "ok" });
    expect(fetch.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      "DELETE http://api.test/me/finance/credentials",
      "DELETE http://api.test/me/finance",
    ]);
  });

  it("is an error for another status", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    expect(await deleteFinanceData()).toEqual({ kind: "error" });
  });
});

describe("createConnectToken", () => {
  it("reads the token and the sandbox flag", async () => {
    const fetch = stubFetch(Response.json({ connectToken: "tok", includeSandbox: true }));
    expect(await createConnectToken()).toEqual({ kind: "ok", connectToken: "tok", includeSandbox: true });
    expect(fetch.mock.calls[0]![1]?.method).toBe("POST");
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/finance/connect-token");
  });

  it("is no-credentials on 409, rejected on 422, unavailable on 502", async () => {
    const cases: [number, string][] = [[409, "no-credentials"], [422, "rejected"], [502, "unavailable"]];
    for (const [status, kind] of cases) {
      stubFetch(Response.json({ error: status === 422 ? "pluggy_credentials_rejected" : "x" }, { status }));
      expect(await createConnectToken()).toEqual({ kind });
    }
  });

  it("is an error when the token is missing", async () => {
    stubFetch(Response.json({ includeSandbox: true }));
    expect(await createConnectToken()).toEqual({ kind: "error" });
  });
});

describe("registerItem", () => {
  it("posts the item id and returns the new status", async () => {
    const fetch = stubFetch(Response.json(STATUS));
    expect(await registerItem("item-1")).toEqual({ kind: "ok", status: STATUS });
    expect(JSON.parse(String(fetch.mock.calls[0]![1]?.body))).toEqual({ itemId: "item-1" });
  });

  it("is item-refused for a 422 that is not about the credentials", async () => {
    stubFetch(Response.json({ error: "item login failed" }, { status: 422 }));
    expect(await registerItem("item-1")).toEqual({ kind: "item-refused" });
  });
});

const MONTH = {
  month: "2026-11",
  spentCents: 1000,
  categories: [{ category: "groceries", spentCents: 1000 }],
  transactions: [
    { id: "t1", postedOn: "2026-11-02", description: "Mercado", sourceName: "Nubank", amountCents: -1000, currency: "BRL", type: "expense", spendingCategory: "groceries", typeSetBy: "rule", categorySetBy: "rule", installment: null },
  ],
};

describe("getMonth", () => {
  it("reads GET /me/finance/transactions with the month", async () => {
    const fetch = stubFetch(Response.json(MONTH));
    expect(await getMonth("2026-11")).toEqual({ kind: "ok", month: MONTH });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/finance/transactions?month=2026-11");
  });

  it("is an error for a body it cannot read", async () => {
    stubFetch(Response.json({ ...MONTH, transactions: [{ id: 1 }] }));
    expect(await getMonth("2026-11")).toEqual({ kind: "error" });
  });
});

describe("patchTransaction", () => {
  it("sends only the fields changed", async () => {
    const fetch = stubFetch(Response.json(MONTH.transactions[0]));
    expect(await patchTransaction("t1", { type: "transfer" })).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(`${init?.method} ${url}`).toBe("PATCH http://api.test/me/finance/transactions/t1");
    expect(JSON.parse(String(init?.body))).toEqual({ type: "transfer" });
  });

  it("names a missing row and a refused edit", async () => {
    stubFetch(Response.json({ error: "not found" }, { status: 404 }));
    expect(await patchTransaction("t1", { type: "income" })).toEqual({ kind: "not-found" });
    stubFetch(Response.json({ error: "x" }, { status: 400 }));
    expect(await patchTransaction("t1", { spendingCategory: "pets" })).toEqual({ kind: "invalid" });
  });
});

const BILL = { id: "b1", name: "Luz", expectedCents: 15000, dueDay: 10, dueDate: "2030-01-10", paid: false, paidBy: null };
const INPUT = { name: "Luz", expectedCents: 15000, dueDay: 10 };

describe("getBills", () => {
  it("reads the list for the month", async () => {
    const fetch = stubFetch(Response.json([BILL]));
    expect(await getBills("2030-01")).toEqual({ kind: "ok", bills: [BILL] });
    expect(fetch.mock.calls[0]![0]).toBe("http://api.test/me/finance/bills?month=2030-01");
  });

  it("is an error for a bill it cannot read", async () => {
    stubFetch(Response.json([{ ...BILL, paidBy: "other" }]));
    expect(await getBills("2030-01")).toEqual({ kind: "error" });
  });
});

describe("saveBill", () => {
  it("posts a new bill and expects 201", async () => {
    const fetch = stubFetch(Response.json(BILL, { status: 201 }));
    expect(await saveBill(null, INPUT)).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(`${init?.method} ${url}`).toBe("POST http://api.test/me/finance/bills");
  });

  it("puts an existing bill and expects 200, not 201", async () => {
    const fetch = stubFetch(Response.json(BILL));
    expect(await saveBill("b1", INPUT)).toEqual({ kind: "ok" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(`${init?.method} ${url}`).toBe("PUT http://api.test/me/finance/bills/b1");
    stubFetch(Response.json(BILL, { status: 201 }));
    expect(await saveBill("b1", INPUT)).not.toEqual({ kind: "ok" });
  });

  it("hands field codes to the form on a 400", async () => {
    stubFetch(Response.json({ fields: { name: "invalid" } }, { status: 400 }));
    expect(await saveBill(null, INPUT)).toEqual({ kind: "fields", fields: { name: "invalid" } });
  });

  it("names the other failures", async () => {
    stubFetch(Response.json({ error: "x" }, { status: 400 }));
    expect(await saveBill(null, INPUT)).toEqual({ kind: "invalid" });
    stubFetch(Response.json({ error: "not found" }, { status: 404 }));
    expect(await saveBill("b1", INPUT)).toEqual({ kind: "not-found" });
    stubFetch(new Error("down"));
    expect(await saveBill(null, INPUT)).toEqual({ kind: "offline" });
  });
});

describe("deleteBill and setBillPaid", () => {
  it("deletes a bill", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await deleteBill("b1")).toEqual({ kind: "ok" });
    expect(`${fetch.mock.calls[0]![1]?.method} ${fetch.mock.calls[0]![0]}`).toBe("DELETE http://api.test/me/finance/bills/b1");
  });

  it("marks paid with PUT and unmarks with DELETE", async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    expect(await setBillPaid("b1", "2030-01", true)).toEqual({ kind: "ok" });
    expect(await setBillPaid("b1", "2030-01", false)).toEqual({ kind: "ok" });
    const calls = fetch.mock.calls.map(([u, i]) => `${i?.method} ${u}`);
    expect(calls).toEqual([
      "PUT http://api.test/me/finance/bills/b1/payments/2030-01",
      "DELETE http://api.test/me/finance/bills/b1/payments/2030-01",
    ]);
  });
});
