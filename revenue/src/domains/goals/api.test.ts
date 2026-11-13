import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { createApiClient } from "../../api/client";
import { createSessionStore } from "../../auth/session";
import { deleteGoal, deleteInvestment, getSavings, parseSavings, putContribution, putGoalOrder, putInvestmentServes, putReserve, saveGoal, saveInvestment, restoreBankValue } from "./api";

const GOAL = { id: "g1", name: "Reforma", targetCents: 500000, targetMonth: "2027-07", savedCents: 100000, monthCents: 20000, expectedMonth: "2028-01", late: true };
const SAVINGS = {
  reserveTargetCents: 900000, contributionBaseCents: 100000, reserveSharePercent: 30, investments: [],
  reserve: { targetCents: 900000, savedCents: 300000, monthCents: 30000, expectedMonth: "2029-04" },
  goals: [GOAL], unassignedCents: 0,
};

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
const body = (sent: InternalAxiosRequestConfig[]) => JSON.parse(String(sent[0]!.data));

describe("parseSavings", () => {
  it("reads the settings, the reserve and the Goals in order", () => {
    expect(parseSavings(SAVINGS)).toEqual(SAVINGS);
  });

  it("reads hand-typed and bank Investments, with what is not picked, edited or gone", () => {
    const investments = [
      { id: "i1", name: "CDB", valueCents: 1000, serves: null, source: "pluggy", edited: false, bankValueCents: 1000, reportedByBank: true },
      { id: "i2", name: "Tesouro", valueCents: 5, serves: "reserve", source: "hand", edited: false, somethingNew: [1] },
      { id: "i3", name: "Fundo", valueCents: 7, serves: "goals", source: "pluggy", edited: true, bankValueCents: 9, reportedByBank: false },
    ];
    const parsed = parseSavings({ ...SAVINGS, investments, leftover: { leftoverCents: 1, extraCents: 1, monthsSooner: null }, brandNew: true, goals: [{ ...GOAL, colour: "red" }] });
    expect(parsed?.goals).toEqual([GOAL]);
    expect(parsed?.investments).toEqual([
      { id: "i1", name: "CDB", valueCents: 1000, serves: null, source: "pluggy", edited: false, bankValueCents: 1000, reportedByBank: true },
      { id: "i2", name: "Tesouro", valueCents: 5, serves: "reserve", source: "hand", edited: false, bankValueCents: null, reportedByBank: true },
      { id: "i3", name: "Fundo", valueCents: 7, serves: "goals", source: "pluggy", edited: true, bankValueCents: 9, reportedByBank: false },
    ]);
  });

  it("reads no Investments as an empty list", () => {
    expect(parseSavings({ ...SAVINGS, investments: undefined })?.investments).toEqual([]);
  });

  it("takes null settings, amounts and months", () => {
    const parsed = parseSavings({
      ...SAVINGS, reserveTargetCents: null, contributionBaseCents: null, reserveSharePercent: null,
      reserve: { targetCents: null, savedCents: 0, monthCents: null, expectedMonth: null },
      goals: [{ ...GOAL, targetMonth: null, monthCents: null, expectedMonth: null, late: false }],
    });
    expect(parsed?.reserve.targetCents).toBeNull();
  });

  it.each([
    ["not an object", null],
    ["no goals", { ...SAVINGS, goals: undefined }],
    ["a Goal without an id", { ...SAVINGS, goals: [{ ...GOAL, id: 1 }] }],
    ["a Goal without late", { ...SAVINGS, goals: [{ ...GOAL, late: undefined }] }],
    ["a text reserve", { ...SAVINGS, reserve: { ...SAVINGS.reserve, savedCents: "1" } }],
    ["an Investment serving nothing known", { ...SAVINGS, investments: [{ id: "i", name: "x", valueCents: 1, serves: "car", source: "hand", edited: false }] }],
    ["an Investment of unknown source", { ...SAVINGS, investments: [{ id: "i", name: "x", valueCents: 1, serves: null, source: "x", edited: false }] }],
    ["an Investment with a text value", { ...SAVINGS, investments: [{ id: "i", name: "x", valueCents: "1", serves: null, source: "hand", edited: false }] }],
    ["no unassigned amount", { ...SAVINGS, unassignedCents: undefined }],
  ])("refuses %s", (_, v) => expect(parseSavings(v)).toBeNull());
});

describe("getSavings", () => {
  it("reads GET /me/finance/savings", async () => {
    const { client, sent } = setup(200, SAVINGS);
    expect((await getSavings(client)).goals).toHaveLength(1);
    expect(sent[0]!.url).toBe("/me/finance/savings");
  });
  it("throws on a failure status and on a malformed body", async () => {
    await expect(getSavings(setup(503, {}).client)).rejects.toThrow();
    await expect(getSavings(setup(200, { goals: 1 }).client)).rejects.toThrow();
  });
});

describe("saveGoal", () => {
  const input = { name: "Reforma", targetCents: 500000, targetMonth: null };
  it("POSTs a new Goal and expects 201", async () => {
    const { client, sent } = setup(201, {});
    expect(await saveGoal(null, input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/goals");
    expect(body(sent)).toEqual(input);
  });
  it("PUTs an edit to the encoded id and expects 200", async () => {
    const { client, sent } = setup(200, {});
    expect(await saveGoal("a/b", input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/goals/a%2Fb");
  });
  it("hands a 400's field codes to the form, and tells 404 and failures apart", async () => {
    expect(await saveGoal(null, input, setup(400, { fields: { targetMonth: "invalid" } }).client)).toEqual({ kind: "fields", fields: { targetMonth: "invalid" } });
    expect(await saveGoal("g1", input, setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await saveGoal("g1", input, setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await saveGoal("g1", input, setup(200, {}, true).client)).toEqual({ kind: "error" });
  });
});

describe("deleteGoal", () => {
  it("DELETEs and expects 204", async () => {
    const { client, sent } = setup(204, "");
    expect(await deleteGoal("g1", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("delete");
    expect(sent[0]!.url).toBe("/me/finance/goals/g1");
    expect(await deleteGoal("g1", setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await deleteGoal("g1", setup(500, {}).client)).toEqual({ kind: "error" });
  });
});

describe("putGoalOrder", () => {
  it("PUTs the ids", async () => {
    const { client, sent } = setup(204, "");
    expect(await putGoalOrder(["b", "a"], client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/goals/order");
    expect(body(sent)).toEqual({ ids: ["b", "a"] });
  });
  it("calls a 400 a changed list, and the rest failures", async () => {
    expect(await putGoalOrder(["a"], setup(400, {}).client)).toEqual({ kind: "changed" });
    expect(await putGoalOrder(["a"], setup(500, {}).client)).toEqual({ kind: "error" });
    expect(await putGoalOrder(["a"], setup(204, "", true).client)).toEqual({ kind: "error" });
  });
});

describe("putReserve", () => {
  it("sends the target, or null to clear it", async () => {
    const set = setup(204, "");
    expect(await putReserve(900000, set.client)).toEqual({ kind: "ok" });
    expect(set.sent[0]!.url).toBe("/me/finance/reserve");
    expect(body(set.sent)).toEqual({ targetCents: 900000 });
    const clear = setup(204, "");
    await putReserve(null, clear.client);
    expect(body(clear.sent)).toEqual({ targetCents: null });
    expect(await putReserve(1, setup(500, {}).client)).toEqual({ kind: "error" });
  });
});

describe("putContribution", () => {
  it("sends the base and the share", async () => {
    const { client, sent } = setup(204, "");
    expect(await putContribution({ baseCents: 100000, reserveSharePercent: 30 }, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.url).toBe("/me/finance/contribution");
    expect(body(sent)).toEqual({ baseCents: 100000, reserveSharePercent: 30 });
  });
  it("clears both fields together with null", async () => {
    const { client, sent } = setup(204, "");
    await putContribution(null, client);
    expect(body(sent)).toEqual({ baseCents: null, reserveSharePercent: null });
  });
});

describe("saveInvestment", () => {
  const input = { name: "CDB", valueCents: 0, serves: "reserve" as const };
  it("POSTs a new Investment and expects 201", async () => {
    const { client, sent } = setup(201, {});
    expect(await saveInvestment(null, input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/investments");
    expect(body(sent)).toEqual(input);
  });
  it("PUTs an edit (a bank value too) and hands 400 codes back", async () => {
    const { client, sent } = setup(200, {});
    expect(await saveInvestment("i/1", input, client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/investments/i%2F1");
    expect(await saveInvestment("i1", input, setup(400, { fields: { valueCents: "invalid" } }).client)).toEqual({ kind: "fields", fields: { valueCents: "invalid" } });
    expect(await saveInvestment("i1", input, setup(500, {}).client)).toEqual({ kind: "error" });
  });
});

describe("deleteInvestment", () => {
  it("DELETEs and expects 204; a bank one (409) is an error", async () => {
    const { client, sent } = setup(204, "");
    expect(await deleteInvestment("i1", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("delete");
    expect(sent[0]!.url).toBe("/me/finance/investments/i1");
    expect(await deleteInvestment("i1", setup(409, {}).client)).toEqual({ kind: "error" });
    expect(await deleteInvestment("i1", setup(404, {}).client)).toEqual({ kind: "not-found" });
  });
});

describe("putInvestmentServes", () => {
  it("PUTs the pick and expects 204", async () => {
    const { client, sent } = setup(204, "");
    expect(await putInvestmentServes("i1", "goals", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("put");
    expect(sent[0]!.url).toBe("/me/finance/investments/i1/serves");
    expect(body(sent)).toEqual({ serves: "goals" });
  });
  it("tells a missing row, a refusal, a wrong status and a network failure apart", async () => {
    expect(await putInvestmentServes("i1", "goals", setup(404, {}).client)).toEqual({ kind: "not-found" });
    expect(await putInvestmentServes("i1", "goals", setup(400, { error: "invalid serves" }).client)).toEqual({ kind: "error" });
    expect(await putInvestmentServes("i1", "goals", setup(200, {}).client)).toEqual({ kind: "error" });
    expect(await putInvestmentServes("i1", "goals", setup(204, "", true).client)).toEqual({ kind: "error" });
  });
});

describe("restoreBankValue", () => {
  it("POSTs and expects 200", async () => {
    const { client, sent } = setup(200, { id: "i1" });
    expect(await restoreBankValue("i1", client)).toEqual({ kind: "ok" });
    expect(sent[0]!.method).toBe("post");
    expect(sent[0]!.url).toBe("/me/finance/investments/i1/use-bank-value");
  });
  it("calls 409 (a hand-typed one), a wrong status and a network failure errors; 404 not found", async () => {
    expect(await restoreBankValue("i1", setup(409, {}).client)).toEqual({ kind: "error" });
    expect(await restoreBankValue("i1", setup(204, "").client)).toEqual({ kind: "error" });
    expect(await restoreBankValue("i1", setup(200, {}, true).client)).toEqual({ kind: "error" });
    expect(await restoreBankValue("i1", setup(404, {}).client)).toEqual({ kind: "not-found" });
  });
});
