import { describe, expect, it } from "vitest";
import { contributionOf, goalInputOf, groupInvestments, investmentInputOf, moveId,reserveTargetOf, savingsFieldErrorKey, splitContribution } from "./savings";

describe("investmentInputOf", () => {
  it("reads a name, a value and what it serves", () => {
    expect(investmentInputOf({ name: " CDB ", value: "1.234,50", serves: "reserve" }, "pt-BR")).toEqual({
      ok: true,
      input: { name: "CDB", valueCents: 123450, serves: "reserve" },
    });
  });
  it("accepts a value of zero, an Investment emptied but kept", () => {
    expect(investmentInputOf({ name: "CDB", value: "0", serves: "goals" }, "en-US")).toMatchObject({ ok: true, input: { valueCents: 0 } });
    expect(investmentInputOf({ name: "CDB", value: "R$ 0,00", serves: "goals" }, "pt-BR")).toMatchObject({ ok: true, input: { valueCents: 0 } });
  });
  it("names each refused field", () => {
    expect(investmentInputOf({ name: " ", value: "abc", serves: "reserve" }, "pt-BR")).toEqual({
      ok: false,
      errors: { name: "required", valueCents: "invalid" },
    });
    expect(investmentInputOf({ name: "x".repeat(61), value: "", serves: "reserve" }, "pt-BR")).toMatchObject({ errors: { name: "too_long", valueCents: "invalid" } });
  });
});

describe("goalInputOf", () => {
  it("sends the month as YYYY-MM, or null when left empty", () => {
    expect(goalInputOf({ name: "Reforma", target: "50.000,00", month: "2027-05" }, "pt-BR")).toEqual({
      ok: true,
      input: { name: "Reforma", targetCents: 5000000, targetMonth: "2027-05" },
    });
    expect(goalInputOf({ name: "Reforma", target: "500", month: "" }, "pt-BR")).toMatchObject({ input: { targetMonth: null } });
  });
  it("reads a month typed as MM/YYYY when the browser shows a plain text field", () => {
    expect(goalInputOf({ name: "a", target: "1", month: "05/2027" }, "pt-BR")).toMatchObject({ input: { targetMonth: "2027-05" } });
  });
  it("refuses a target of zero and a month that is not one", () => {
    expect(goalInputOf({ name: "a", target: "0", month: "2027-13" }, "pt-BR")).toEqual({ ok: false, errors: { targetCents: "invalid", targetMonth: "invalid" } });
    expect(goalInputOf({ name: "a", target: "1", month: "maio" }, "pt-BR")).toMatchObject({ errors: { targetMonth: "invalid" } });
  });
});

describe("reserveTargetOf", () => {
  it("reads a positive amount and refuses zero or text", () => {
    expect(reserveTargetOf("30.000", "pt-BR")).toEqual({ ok: true, cents: 3000000 });
    expect(reserveTargetOf("0", "pt-BR")).toEqual({ ok: false, errors: { targetCents: "invalid" } });
    expect(reserveTargetOf("", "pt-BR")).toEqual({ ok: false, errors: { targetCents: "invalid" } });
  });
});

describe("contributionOf", () => {
  it("reads the base and a whole share from 0 to 100", () => {
    expect(contributionOf({ base: "1000", share: "30" }, "pt-BR")).toEqual({ ok: true, baseCents: 100000, reserveSharePercent: 30 });
    expect(contributionOf({ base: "1000", share: "0" }, "pt-BR")).toMatchObject({ ok: true, reserveSharePercent: 0 });
    expect(contributionOf({ base: "1000", share: "100" }, "pt-BR")).toMatchObject({ ok: true, reserveSharePercent: 100 });
  });
  it("refuses a share out of bounds, fractional or empty", () => {
    for (const share of ["101", "-1", "30,5", "", "x"]) {
      expect(contributionOf({ base: "1000", share }, "pt-BR"), share).toEqual({ ok: false, errors: { reserveSharePercent: "invalid" } });
    }
    expect(contributionOf({ base: "0", share: "50" }, "pt-BR")).toEqual({ ok: false, errors: { baseCents: "invalid" } });
  });
});

describe("splitContribution", () => {
  it("splits half-up and the two parts always add up", () => {
    expect(splitContribution(100000, 30)).toEqual({ reserveCents: 30000, goalsCents: 70000 });
    expect(splitContribution(1, 50)).toEqual({ reserveCents: 1, goalsCents: 0 });
    expect(splitContribution(999, 33)).toEqual({ reserveCents: 330, goalsCents: 669 }); // 329.67 rounds up
    expect(splitContribution(1001, 50)).toEqual({ reserveCents: 501, goalsCents: 500 }); // 500.5 rounds up
    expect(splitContribution(5000, 0)).toEqual({ reserveCents: 0, goalsCents: 5000 });
  });
});

describe("moveId", () => {
  it("moves one id a place and stays put at the ends", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
    expect(moveId(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
    expect(moveId(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
    expect(moveId(["a"], "zz", "up")).toEqual(["a"]);
  });
});

describe("groupInvestments", () => {
  it("groups by what they serve with subtotals, reserve first, leaving out an empty group", () => {
    const list = [
      { id: "1", name: "a", valueCents: 100, serves: "goals" as const },
      { id: "2", name: "b", valueCents: 250, serves: "reserve" as const },
      { id: "3", name: "c", valueCents: 50, serves: "goals" as const },
    ];
    expect(groupInvestments(list).map((g) => [g.serves, g.subtotalCents, g.items.map((i) => i.id)])).toEqual([
      ["reserve", 250, ["2"]],
      ["goals", 150, ["1", "3"]],
    ]);
    expect(groupInvestments(list.slice(0, 1)).map((g) => g.serves)).toEqual(["goals"]);
  });
});

describe("savingsFieldErrorKey", () => {
  it("maps a known code and falls back for an unknown one", () => {
    expect(savingsFieldErrorKey("name", "required")).toBe("finances.savings.field.name.required");
    expect(savingsFieldErrorKey("serves", "invalid")).toBe("finances.savings.field.unknown");
  });
});
