import { describe, expect, it } from "vitest";
import { firstReconnect, firstShortMonth, goalsProgress } from "./plan";

describe("goalsProgress", () => {
  it("is the saved over the target of every Goal together", () => {
    expect(goalsProgress([{ savedCents: 100, targetCents: 400 }, { savedCents: 300, targetCents: 600 }])).toBe(0.4);
  });
  it("is null with no Goal", () => expect(goalsProgress([])).toBeNull());
});

describe("firstShortMonth", () => {
  it("is the first negative Leftover, skipping a month with no income set", () => {
    expect(firstShortMonth([{ month: "2030-01" }, { month: "2030-02", leftoverCents: 5 }, { month: "2030-03", leftoverCents: -160000 }, { month: "2030-04", leftoverCents: -1 }])).toEqual({ month: "2030-03", cents: -160000 });
  });
  it("is null when no month is short", () => expect(firstShortMonth([{ month: "2030-01", leftoverCents: 0 }])).toBeNull());
});

describe("firstReconnect", () => {
  it("finds the first bank to reconnect", () => {
    expect(firstReconnect([{ id: "a", bankName: "Nubank", status: "ok", products: 1 }, { id: "b", bankName: "Itaú", status: "reconnect", products: 1 }])).toEqual({ bankName: "Itaú" });
  });
  it("is null when all are ok", () => expect(firstReconnect([{ id: "a", bankName: null, status: "ok", products: 1 }])).toBeNull());
});
