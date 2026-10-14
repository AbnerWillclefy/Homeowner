import { describe, expect, it } from "vitest";
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
