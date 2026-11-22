import { describe, expect, it } from "vitest";
import type { CommitmentMonth } from "../../overview/api/api";
import { projectionRow, seriesCents } from "./projectionRow";

const month = (change: Partial<CommitmentMonth> = {}): CommitmentMonth => ({
  month: "2030-01", installments: [], cards: [], otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 0, totalCents: 0, ...change,
});

describe("projectionRow", () => {
  it("reads the Leftover at the current pace, null without income", () => {
    expect(projectionRow(month({ leftoverCents: 100, paceLeftoverCents: -300 })).paceLeftoverCents).toBe(-300);
    expect(projectionRow(month()).paceLeftoverCents).toBeNull();
  });

  it("cuts a limited category by what its pace is over its plan", () => {
    const row = projectionRow(month({ planned: [{ category: "eating_out", cents: 100000, paceCents: 220000, limited: true }] }));
    expect(row.cuts).toEqual([{ category: "eating_out", planCents: 100000, paceCents: 220000, cutCents: 120000 }]);
  });

  it("never cuts below zero when the pace is at or under the plan", () => {
    const row = projectionRow(month({ planned: [{ category: "pets", cents: 50000, paceCents: 20000, limited: true }, { category: "health", cents: 5, paceCents: 5, limited: true }] }));
    expect(row.cuts.map((c) => c.cutCents)).toEqual([0, 0]);
  });

  it("leaves out a category with no limit", () => {
    const row = projectionRow(month({ planned: [{ category: "groceries", cents: 30000, paceCents: 90000, limited: false }] }));
    expect(row.cuts).toEqual([]);
  });

  it("picks the Leftover of the shown series, null without income", () => {
    const row = projectionRow(month({ leftoverCents: 100, paceLeftoverCents: -300 }));
    expect([seriesCents(row, "plan"), seriesCents(row, "pace")]).toEqual([100, -300]);
    expect(seriesCents(projectionRow(month()), "pace")).toBeNull();
  });
});
