import { describe, expect, it } from "vitest";
import { choreCategories } from "../chores/choreCategories";
import { preferenceCategories } from "./preferenceCategories";

const fromApi = ["kitchen", "bathroom", "other", "pets"];

describe("preferenceCategories", () => {
  it("drops Other and keeps the rest in order", () => {
    expect(preferenceCategories(fromApi)).toEqual(["kitchen", "bathroom", "pets"]);
  });

  it("leaves nothing when Other is the only Category", () => {
    expect(preferenceCategories(["other"])).toEqual([]);
  });
});

describe("choreCategories", () => {
  it("still offers Other for a Chore", () => {
    expect(choreCategories(fromApi)).toEqual(fromApi);
  });
});
