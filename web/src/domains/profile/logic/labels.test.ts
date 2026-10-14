import { describe, expect, it } from "vitest";
import { categoryLabel, demandLabel, importanceLabel } from "./labels";

describe("importanceLabel", () => {
  it("points at the catalog key for an Importance and falls back to the id", () => {
    expect(importanceLabel("nice_to_have")).toEqual({ key: "importance.nice_to_have" });
    expect(importanceLabel("urgent")).toEqual({ text: "urgent" });
  });
});

describe("categoryLabel and demandLabel", () => {
  it("point at the catalog key for an id the app knows", () => {
    expect(categoryLabel("living_room")).toEqual({ key: "category.living_room" });
    expect(demandLabel("heavy_lifting")).toEqual({ key: "demand.heavy_lifting" });
  });

  it("fall back to the id itself for one the API returns that has no translation", () => {
    expect(categoryLabel("garage")).toEqual({ text: "garage" });
    expect(demandLabel("confined_spaces")).toEqual({ text: "confined_spaces" });
  });

  it("do not mix the two lists", () => {
    expect(categoryLabel("bending")).toEqual({ text: "bending" });
    expect(demandLabel("kitchen")).toEqual({ text: "kitchen" });
  });

  it("do not treat inherited object properties as ids", () => {
    expect(categoryLabel("constructor")).toEqual({ text: "constructor" });
  });
});
