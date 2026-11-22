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

  it("picks the Leftover of the shown series, null without income", () => {
    const row = projectionRow(month({ leftoverCents: 100, paceLeftoverCents: -300 }));
    expect([seriesCents(row, "plan"), seriesCents(row, "pace")]).toEqual([100, -300]);
    expect(seriesCents(projectionRow(month()), "pace")).toBeNull();
  });
});
