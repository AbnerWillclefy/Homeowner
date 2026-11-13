import { describe, expect, it } from "vitest";
import { contributionOf, goalFieldErrorKey, goalInputOf, moveId, monthOf, progressPercent, reserveTargetOf, splitContribution, whenOf } from "./savings";

describe("goalInputOf", () => {
  it("trims the name and reads the month", () =>
    expect(goalInputOf({ name: " Reforma ", cents: 500000, month: "05/2027" })).toEqual({ ok: true, input: { name: "Reforma", targetCents: 500000, targetMonth: "2027-05" } }));
  it("lets the date stay empty", () =>
    expect(goalInputOf({ name: "Viagem", cents: 1, month: "" })).toEqual({ ok: true, input: { name: "Viagem", targetCents: 1, targetMonth: null } }));
  it("names every field that is wrong", () =>
    expect(goalInputOf({ name: " ", cents: 0, month: "2027-13" })).toEqual({ ok: false, errors: { name: "required", targetCents: "invalid", targetMonth: "invalid" } }));
  it("refuses a name over 60 characters", () => expect(goalInputOf({ name: "a".repeat(61), cents: 1, month: "" })).toMatchObject({ ok: false, errors: { name: "too_long" } }));
});

describe("monthOf", () => {
  it.each([["", null], ["2027-05", "2027-05"], ["5/2027", "2027-05"], ["12/2030", "2030-12"], ["2027-5", undefined], ["13/2027", undefined]])("%s", (text, month) => expect(monthOf(text)).toBe(month));
});

describe("reserveTargetOf and contributionOf", () => {
  it("need an amount above zero", () => {
    expect(reserveTargetOf(null)).toMatchObject({ ok: false });
    expect(reserveTargetOf(0)).toMatchObject({ ok: false });
    expect(reserveTargetOf(900000)).toEqual({ ok: true, cents: 900000 });
  });
  it("read a share from 0 to 100", () => {
    expect(contributionOf({ cents: 100000, share: "30" })).toEqual({ ok: true, baseCents: 100000, reserveSharePercent: 30 });
    expect(contributionOf({ cents: 100000, share: "0" })).toMatchObject({ ok: true });
    expect(contributionOf({ cents: 100000, share: "101" })).toEqual({ ok: false, errors: { reserveSharePercent: "invalid" } });
    expect(contributionOf({ cents: null, share: "x" })).toEqual({ ok: false, errors: { baseCents: "invalid", reserveSharePercent: "invalid" } });
  });
});

it("splits the contribution rounding half up, the parts adding up", () => {
  expect(splitContribution(1001, 50)).toEqual({ reserveCents: 501, goalsCents: 500 });
  expect(splitContribution(100000, 30)).toEqual({ reserveCents: 30000, goalsCents: 70000 });
});

describe("moveId", () => {
  it("swaps with the neighbour", () => {
    expect(moveId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("stays at the ends and for an unknown id", () => {
    expect(moveId(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "b", "down")).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "x", "down")).toEqual(["a", "b"]);
  });
});

it("keeps the progress within 0 to 100", () => {
  expect(progressPercent(250, 1000)).toBe(25);
  expect(progressPercent(1500, 1000)).toBe(100);
  expect(progressPercent(-5, 1000)).toBe(0);
  expect(progressPercent(5, 0)).toBe(0);
});

describe("whenOf", () => {
  const base = { savedCents: 100, targetCents: 1000, monthCents: 50, expectedMonth: "2030-05" };
  it("tells reached, none, beyond and expected", () => {
    expect(whenOf({ ...base, savedCents: 1000 })).toEqual({ kind: "reached" });
    expect(whenOf({ ...base, monthCents: null })).toEqual({ kind: "none" });
    expect(whenOf({ ...base, expectedMonth: null })).toEqual({ kind: "beyond" });
    expect(whenOf(base)).toEqual({ kind: "expected", month: "2030-05" });
  });
});

it("gives an unknown code a message", () => {
  expect(goalFieldErrorKey("name", "required")).toBe("goals.field.name.required");
  expect(goalFieldErrorKey("name", "weird")).toBe("goals.field.unknown");
});
