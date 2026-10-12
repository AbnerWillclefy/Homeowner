import { describe, expect, it } from "vitest";
import type { Chore } from "../chores/api";
import { RATING_CHORE_COUNT, selectChoresToRate } from "./ratingChores";

function chore(id: string, name: string, baseEffort: number, importance = "normal"): Chore {
  return {
    id,
    name,
    category: "kitchen",
    demands: [],
    baseEffort,
    importance,
    people: 1,
    intervalDays: 1,
    allowedWeekdays: [],
    buildsUp: false,
  };
}

describe("selectChoresToRate", () => {
  it("puts the highest base Effort first", () => {
    const picked = selectChoresToRate([chore("a", "Dishes", 2), chore("b", "Mop", 5), chore("c", "Bins", 3)]);
    expect(picked.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks an Effort tie by Importance, essential first, then by name", () => {
    const picked = selectChoresToRate([
      chore("a", "Zebra", 4, "nice_to_have"),
      chore("b", "Yard", 4, "normal"),
      chore("c", "Mop", 4, "essential"),
      chore("d", "Apple", 4, "normal"),
    ]);
    expect(picked.map((c) => c.id)).toEqual(["c", "d", "b", "a"]);
  });

  it("takes about eight, and the number is a constant", () => {
    expect(RATING_CHORE_COUNT).toBe(8);
    const many = Array.from({ length: 12 }, (_, i) => chore(`c${i}`, `Chore ${String(i).padStart(2, "0")}`, 3));
    expect(selectChoresToRate(many)).toHaveLength(8);
  });

  it("returns what exists when there are fewer, or none, and leaves its input alone", () => {
    expect(selectChoresToRate([])).toEqual([]);
    const input = [chore("a", "A", 1), chore("b", "B", 5)];
    expect(selectChoresToRate(input)).toHaveLength(2);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("puts an Importance this app does not know after the known ones", () => {
    const picked = selectChoresToRate([chore("a", "A", 3, "mystery"), chore("b", "B", 3, "nice_to_have")]);
    expect(picked.map((c) => c.id)).toEqual(["b", "a"]);
  });
});
