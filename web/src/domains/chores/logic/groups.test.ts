import { describe, expect, it } from "vitest";
import { groupByCategory } from "./groups";

const chore = (id: string, category: string) => ({ id, category });

describe("groupByCategory", () => {
  it("groups Chores in the order the Categories come, keeping each group's order and skipping empty ones", () => {
    const groups = groupByCategory([chore("a", "trash"), chore("b", "kitchen"), chore("c", "trash")], ["kitchen", "bathroom", "trash"]);
    expect(groups).toEqual([
      { category: "kitchen", chores: [chore("b", "kitchen")] },
      { category: "trash", chores: [chore("a", "trash"), chore("c", "trash")] },
    ]);
  });

  it("puts a Category the app has no style for under other, last", () => {
    const groups = groupByCategory([chore("a", "garage"), chore("b", "kitchen")], ["kitchen", "other"]);
    expect(groups.map((group) => group.category)).toEqual(["kitchen", "other"]);
  });

  it("never drops a Chore whose Category is missing from the list", () => {
    const groups = groupByCategory([chore("a", "floors")], ["kitchen"]);
    expect(groups).toEqual([{ category: "floors", chores: [chore("a", "floors")] }]);
  });
});
