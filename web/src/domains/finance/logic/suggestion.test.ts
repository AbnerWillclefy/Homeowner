import { describe, expect, it } from "vitest";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { ptBR } from "../../../shared/i18n/catalogs/pt-BR";
import type { Locale } from "../../../shared/i18n/locales";
import { createTranslate, type Catalogs } from "../../../shared/i18n/translate";
import type { Savings, SavingsGoal } from "../api/api";
import { monthsAfter, progressPercent, suggestionOf, whenOf, whenText, type When } from "./suggestion";

const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: "g1",
  name: "Reforma",
  targetCents: 1000000,
  targetMonth: null,
  savedCents: 200000,
  monthCents: 60000,
  expectedMonth: "2027-05",
  late: false,
  ...over,
});

const savings = (over: Partial<Savings> = {}): Savings => ({
  reserveTargetCents: 3000000,
  contributionBaseCents: 100000,
  reserveSharePercent: 40,
  investments: [],
  reserve: { targetCents: 3000000, savedCents: 1230000, monthCents: 40000, expectedMonth: "2029-04" },
  goals: [goal()],
  unassignedCents: 0,
  ...over,
});

const known: { incomeSet: boolean | null; leftoverCents: number | null } = { incomeSet: true, leftoverCents: null };

describe("progressPercent", () => {
  it("is the share of the target, rounded down", () => expect(progressPercent(41999, 100000)).toBe(41));
  it("stops at 100 when more than the target is saved", () => expect(progressPercent(250000, 100000)).toBe(100));
  it("is 0 with nothing saved, a negative amount or no target", () => {
    expect(progressPercent(0, 100000)).toBe(0);
    expect(progressPercent(-5, 100000)).toBe(0);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("monthsAfter", () => {
  it("counts the months from the Goal's date to the expected month, across a year", () => {
    expect(monthsAfter("2027-05", "2027-07")).toBe(2);
    expect(monthsAfter("2026-11", "2027-02")).toBe(3);
  });
});

describe("whenOf", () => {
  const base = { savedCents: 100, targetCents: 1000, monthCents: 50, expectedMonth: "2027-05" };
  it("is the expected month", () => expect(whenOf(base)).toEqual({ kind: "expected", month: "2027-05" }));
  it("is reached at or above the target, whatever else is given", () => {
    expect(whenOf({ ...base, savedCents: 1000 })).toEqual({ kind: "reached" });
    expect(whenOf({ ...base, savedCents: 1500, expectedMonth: null })).toEqual({ kind: "reached" });
  });
  it("is beyond the horizon when no month comes with a contribution, never a blank", () => {
    expect(whenOf({ ...base, expectedMonth: null })).toEqual({ kind: "beyond" });
  });
  it("is none without a Monthly contribution", () => {
    expect(whenOf({ ...base, monthCents: null, expectedMonth: null })).toEqual({ kind: "none" });
  });
  it("is late, with the months after the date, for a late Goal", () => {
    expect(whenOf({ ...base, late: true, targetMonth: "2027-03" })).toEqual({ kind: "late", month: "2027-05", monthsLate: 2 });
  });
  it("is plainly expected for a late Goal whose date is missing", () => {
    expect(whenOf({ ...base, late: true, targetMonth: null })).toEqual({ kind: "expected", month: "2027-05" });
  });
});

describe("whenText", () => {
  const translate = createTranslate({ "en-US": enUS, "pt-BR": ptBR } as Catalogs);
  const say = (locale: Locale, when: When, who: "reserve" | "goal" = "goal") => whenText((key, params) => translate(locale, key, params), locale, when, who);

  it("says the expected month, in the grammatical gender of reserve (feminine) and Goal (masculine)", () => {
    expect(say("pt-BR", { kind: "expected", month: "2029-04" }, "reserve")).toBe("Prevista para Abril de 2029");
    expect(say("pt-BR", { kind: "expected", month: "2029-04" })).toBe("Previsto para Abril de 2029");
    expect(say("en-US", { kind: "expected", month: "2029-04" })).toBe("Expected in April 2029");
  });
  it("says a late Goal's months after its date, in the singular and the plural", () => {
    expect(say("pt-BR", { kind: "late", month: "2027-05", monthsLate: 2 })).toBe("Previsto para Maio de 2027, 2 meses depois da data");
    expect(say("pt-BR", { kind: "late", month: "2027-05", monthsLate: 1 })).toBe("Previsto para Maio de 2027, 1 mês depois da data");
    expect(say("en-US", { kind: "late", month: "2027-05", monthsLate: 2 })).toBe("Expected in May 2027, 2 months after its date");
  });
  it("says reached and beyond the horizon in words, and nothing for none", () => {
    expect(say("pt-BR", { kind: "reached" })).toBe("Meta alcançada");
    expect(say("en-US", { kind: "beyond" })).toBe("Not within 10 years");
    expect(say("en-US", { kind: "none" })).toBeNull();
  });
});

describe("suggestionOf", () => {
  it("is the missing contribution when no Monthly contribution is set", () => {
    expect(suggestionOf(savings({ contributionBaseCents: null, reserveSharePercent: null }), known)).toEqual({ kind: "noContribution" });
  });

  it("lists the reserve first, then each Goal in order, with this month's amounts", () => {
    const s = suggestionOf(savings({ goals: [goal({ id: "a" }), goal({ id: "b", name: "Viagem", monthCents: 0 })] }), known);
    expect(s.kind === "ready" && s.rows.map((r) => r.kind === "unassigned" || r.kind === "noTarget" ? r.kind : `${r.kind}:${r.cents}`)).toEqual(["reserve:40000", "goal:60000", "goal:0"]);
  });

  it("says the reserve has no target, and still lists the Goals", () => {
    const s = suggestionOf(savings({ reserve: { targetCents: null, savedCents: 0, monthCents: 100000, expectedMonth: null } }), known);
    expect(s.kind === "ready" && s.rows.map((r) => r.kind)).toEqual(["noTarget", "goal"]);
  });

  it("shows a reserve at its target as reached with an amount of zero", () => {
    const s = suggestionOf(savings({ reserve: { targetCents: 3000000, savedCents: 3000000, monthCents: 0, expectedMonth: null } }), known);
    expect(s.kind === "ready" && s.rows[0]).toEqual({ kind: "reserve", cents: 0, when: { kind: "reached" } });
  });

  it("shows a full Goal as reached with no monthly amount", () => {
    const s = suggestionOf(savings({ goals: [goal({ savedCents: 1000000, monthCents: 0, expectedMonth: null })] }), known);
    expect(s.kind === "ready" && s.rows[1]).toMatchObject({ kind: "goal", cents: null, when: { kind: "reached" } });
  });

  it("adds a row for money no Goal takes", () => {
    const s = suggestionOf(savings({ unassignedCents: 30000 }), known);
    expect(s.kind === "ready" && s.rows.at(-1)).toEqual({ kind: "unassigned", cents: 30000 });
  });

  describe("the month", () => {
    const month = (s: Savings, ctx = known) => {
      const r = suggestionOf(s, ctx);
      return r.kind === "ready" ? r.month : null;
    };

    it("is above the contribution with the extra and how much sooner", () => {
      expect(month(savings({ leftover: { leftoverCents: 150000, extraCents: 50000, monthsSooner: 1 } }))).toEqual({
        kind: "above",
        leftoverCents: 150000,
        extraCents: 50000,
        monthsSooner: 1,
        reaches: "reserve",
      });
    });

    it("reaches the first Goal sooner when the reserve is at its target or has none", () => {
      const leftover = { leftoverCents: 150000, extraCents: 50000, monthsSooner: 2 };
      const full = { targetCents: 3000000, savedCents: 3000000, monthCents: 0, expectedMonth: null };
      expect(month(savings({ leftover, reserve: full }))).toMatchObject({ reaches: { goal: "Reforma" } });
      expect(month(savings({ leftover, reserve: { ...full, targetCents: null, savedCents: 0 } }))).toMatchObject({ reaches: { goal: "Reforma" } });
    });

    it("names the first Goal that is not full, not the first in the list", () => {
      const leftover = { leftoverCents: 150000, extraCents: 50000, monthsSooner: 2 };
      const full = { targetCents: 3000000, savedCents: 3000000, monthCents: 0, expectedMonth: null };
      const goals = [goal({ id: "a", name: "Carro", savedCents: 1000000, monthCents: 0, expectedMonth: null }), goal({ id: "b", name: "Viagem" })];
      expect(month(savings({ leftover, reserve: full, goals }))).toMatchObject({ reaches: { goal: "Viagem" }, monthsSooner: 2 });
    });

    it("leaves the sooner clause out when it is zero or unknown", () => {
      for (const monthsSooner of [0, null]) {
        expect(month(savings({ leftover: { leftoverCents: 150000, extraCents: 50000, monthsSooner } }))).toMatchObject({ kind: "above", monthsSooner: null });
      }
    });

    it("is below the contribution with the shortfall and the Categories over", () => {
      const over = [{ category: "restaurants", overCents: 12000 }];
      expect(month(savings({ overLimit: over }), { incomeSet: true, leftoverCents: 70000 })).toEqual({ kind: "below", leftoverCents: 70000, shortfallCents: 30000, over });
    });

    it("is below with no Category over when the list is empty", () => {
      expect(month(savings({ overLimit: [] }), { incomeSet: true, leftoverCents: 70000 })).toEqual({ kind: "below", leftoverCents: 70000, shortfallCents: 30000, over: [] });
    });

    it("is below without a shortfall when the leftover could not be read", () => {
      expect(month(savings({ overLimit: [] }), { incomeSet: true, leftoverCents: null })).toMatchObject({ kind: "below", shortfallCents: null });
    });

    it("asks for the income when there is none", () => {
      expect(month(savings(), { incomeSet: false, leftoverCents: null })).toEqual({ kind: "noIncome" });
    });

    it("is neither when the leftover equals the contribution, or the income is not known yet", () => {
      expect(month(savings())).toEqual({ kind: "none" });
      expect(month(savings(), { incomeSet: null, leftoverCents: null })).toEqual({ kind: "none" });
    });
  });
});
