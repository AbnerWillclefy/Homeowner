import { describe, expect, it } from "vitest";
import type { CommitmentMonth } from "../api/api";
import { heroView } from "./hero";

const base: CommitmentMonth = {
  month: "2026-11", installments: [], cards: [], otherBills: [], otherInstallmentsCents: 0, planned: [], plannedCents: 30000, totalCents: 0,
  leftoverCents: 240000, dailyAllowanceCents: 15000,
  pace: { spentCents: [1000, 3000, 6000], lineEndCents: 160000 },
};

describe("heroView", () => {
  it("asks for an income when none is set", () => {
    expect(heroView(base, null, 30)).toEqual({ kind: "invite" });
  });

  it("shows what is left today: the Leftover plus the planned spending, on pace under the line", () => {
    expect(heroView(base, 400000, 30)).toEqual({ kind: "left", cents: 270000, perDayCents: 15000, spentCents: 6000, lineEndCents: 160000, onPace: true });
  });

  it("is off pace strictly above the straight line", () => {
    const view = heroView({ ...base, pace: { spentCents: [100000, 150000, 160000], lineEndCents: 160000 } }, 400000, 30);
    expect(view).toMatchObject({ kind: "left", onPace: false });
  });

  it("has no pace verdict before there is any spending", () => {
    expect(heroView({ ...base, pace: { spentCents: [], lineEndCents: 160000 } }, 400000, 30)).toMatchObject({ kind: "left", onPace: null, spentCents: 0 });
  });

  it("shows a past month as what was spent against the line, with no allowance", () => {
    const past = { ...base, dailyAllowanceCents: undefined, pace: { spentCents: [100, 4000], lineEndCents: 5000 } };
    expect(heroView(past, 400000, 30)).toEqual({ kind: "past", spentCents: 4000, lineEndCents: 5000 });
  });

  it("has nothing to show for a past month without pace", () => {
    expect(heroView({ ...base, dailyAllowanceCents: undefined, pace: undefined }, 400000, 30)).toEqual({ kind: "none" });
  });
});
