import { describe, expect, it } from "vitest";
import type { CommitmentMonth } from "../../overview/api/api";
import { plansInProgress } from "./plansInProgress";

const plan = (name: string, number: number, total: number, amountCents = 1000) => ({ name, number, total, amountCents });
const month = (m: string, ...installments: CommitmentMonth["installments"]) => ({ month: m, installments });

describe("plansInProgress", () => {
  it("ends at the first month plus the parts left, across a year change", () => {
    const [p] = plansInProgress([month("2026-11", plan("Geladeira", 2, 4))]);
    expect(p).toMatchObject({ name: "Geladeira", next: 2, total: 4, last: "2027-01" });
  });

  it("ends this month for a plan whose next part is its last", () => {
    const [p] = plansInProgress([month("2026-11", plan("Sofá", 3, 3))]);
    expect(p).toMatchObject({ next: 3, total: 3, last: "2026-11" });
  });

  it("counts a plan once, from its first appearance", () => {
    const plans = plansInProgress([month("2026-11", plan("Geladeira", 4, 10)), month("2026-12", plan("Geladeira", 5, 10))]);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ next: 4, last: "2027-05" });
  });

  it("tells two plans with one name apart by their total", () => {
    const plans = plansInProgress([month("2026-11", plan("Celular", 1, 2), plan("Celular", 1, 12))]);
    expect(plans.map((p) => p.last)).toEqual(["2026-12", "2027-10"]);
  });

  it("finds the end of a 24-part plan beyond the 12-month horizon", () => {
    const [p] = plansInProgress([month("2026-11", plan("Carro", 2, 24))]);
    expect(p!.last).toBe("2028-09");
  });

  it("keeps the order of first appearance and the amount of the first part shown", () => {
    const plans = plansInProgress([month("2026-11", plan("B", 1, 2, 500)), month("2026-12", plan("A", 1, 3, 700), plan("B", 2, 2))]);
    expect(plans.map((p) => [p.name, p.amountCents])).toEqual([
      ["B", 500],
      ["A", 700],
    ]);
  });
});
