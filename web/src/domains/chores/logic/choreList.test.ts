import { describe, expect, it } from "vitest";
import { removeChore, upsertChore } from "./choreList";
import { chore } from "../testing/fixtures";

const LIST = [chore("a", "Dishes"), chore("b", "Trash"), chore("c", "Floors")];

describe("upsertChore", () => {
  it("adds a new Chore at the end", () => {
    expect(upsertChore(LIST, chore("d", "Windows")).map((c) => c.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("replaces the Chore with the same id and keeps its position", () => {
    const result = upsertChore(LIST, chore("b", "Recycling"));
    expect(result.map((c) => [c.id, c.name])).toEqual([
      ["a", "Dishes"],
      ["b", "Recycling"],
      ["c", "Floors"],
    ]);
  });

  it("does not change the list it was given", () => {
    upsertChore(LIST, chore("d", "Windows"));
    expect(LIST).toHaveLength(3);
  });
});

describe("removeChore", () => {
  it("drops the Chore with that id", () => {
    expect(removeChore(LIST, "b").map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("leaves the list as it is for an unknown id", () => {
    expect(removeChore(LIST, "z")).toEqual(LIST);
  });
});
