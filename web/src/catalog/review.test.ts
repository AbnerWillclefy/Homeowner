import { describe, expect, it } from "vitest";
import type { CatalogEntry, Proposal } from "../api/catalog";
import type { ChoreWire } from "../api/chores";
import type { Translate } from "../i18n";
import { enUS } from "../i18n/catalogs/en-US";
import { formFromEntry, itemsFromProposals, keepLocally, splitSaveErrors, toWire } from "./review";

const english: Translate = (key) => String(enUS[key]);

const FIELDS = {
  category: "bathroom",
  demands: ["bending"],
  baseEffort: 3,
  importance: "essential",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [] as number[],
  buildsUp: true,
};

const PROPOSALS: Proposal[] = [
  { catalogId: "clean_bathroom", instance: 1, name: "Clean the bathroom", ...FIELDS },
  { catalogId: "clean_bathroom", instance: 2, name: "Clean the bathroom", ...FIELDS },
  { catalogId: "put_out_trash", instance: null, name: "Put out the trash", ...FIELDS, intervalDays: 7, allowedWeekdays: [2, 5] },
];

describe("itemsFromProposals", () => {
  it("builds each Chore's name in the app's language, numbering the instances", () => {
    const items = itemsFromProposals(PROPOSALS, english);
    expect(items.map((item) => item.form.name)).toEqual([
      "Clean the bathroom 1",
      "Clean the bathroom 2",
      "Put out the trash",
    ]);
  });

  it("keeps the proposed fields as form state and gives each item its own key", () => {
    const items = itemsFromProposals(PROPOSALS, english);
    expect(new Set(items.map((item) => item.key)).size).toBe(3);
    expect(items[2]!.form).toMatchObject({ intervalDays: "7", allowedWeekdays: [2, 5], buildsUp: true, category: "bathroom" });
  });
});

describe("toWire", () => {
  it("sends every item as the Chore body, with the interval as a number", () => {
    const wire = toWire(itemsFromProposals(PROPOSALS, english));
    expect(wire).toHaveLength(3);
    expect(wire[0]).toEqual({ name: "Clean the bathroom 1", ...FIELDS });
  });

  it("is empty for no items", () => {
    expect(toWire([])).toEqual([]);
  });
});

describe("splitSaveErrors", () => {
  const items = itemsFromProposals(PROPOSALS, english);

  it("maps an indexed key to the item at that position and its own field", () => {
    const result = splitSaveErrors({ "chores.2.baseEffort": "out_of_range", "chores.0.name": "required" }, items);
    expect(result.byItem).toEqual({ [items[2]!.key]: { baseEffort: "out_of_range" }, [items[0]!.key]: { name: "required" } });
    expect(result.settings).toEqual({});
  });

  it("maps by position after an item was removed, so the key names the right Chore", () => {
    const remaining = items.slice(1);
    const result = splitSaveErrors({ "chores.0.name": "too_long" }, remaining);
    expect(result.byItem).toEqual({ [items[1]!.key]: { name: "too_long" } });
  });

  it("keeps the Home's own fields apart from the Chores'", () => {
    const result = splitSaveErrors({ timezone: "unknown", "chores.1.category": "unknown" }, items);
    expect(result.settings).toEqual({ timezone: "unknown" });
    expect(result.byItem).toEqual({ [items[1]!.key]: { category: "unknown" } });
  });

  it("flags too many Chores, and ignores an index that matches no item", () => {
    expect(splitSaveErrors({ chores: "too_many" }, items).tooMany).toBe(true);
    const stray = splitSaveErrors({ "chores.9.name": "required" }, items);
    expect(stray.byItem).toEqual({});
    expect(stray.tooMany).toBe(false);
  });
});

describe("keepLocally", () => {
  const input: ChoreWire = { name: "Wash up", ...FIELDS, intervalDays: 3 };

  it("accepts an edit, handing back the Chore as typed", () => {
    expect(keepLocally("k1", input)).toEqual({ kind: "ok", chore: { id: "k1", ...input } });
    expect(keepLocally("k1", { ...input, intervalDays: null })).toMatchObject({ kind: "ok" });
  });

  it("refuses an interval that is not a number, as the API would", () => {
    expect(keepLocally("k1", { ...input, intervalDays: "often" })).toEqual({
      kind: "invalid",
      fields: { intervalDays: "invalid" },
    });
  });
});

describe("formFromEntry", () => {
  const entry: CatalogEntry = { id: "clean_oven", perRoom: false, name: "Clean the oven", ...FIELDS, category: "kitchen", intervalDays: 90, buildsUp: false };

  it("pre-fills the form from the entry with the localized name", () => {
    expect(formFromEntry(entry, english)).toEqual({
      name: "Clean the oven",
      category: "kitchen",
      demands: ["bending"],
      baseEffort: 3,
      importance: "essential",
      people: 1,
      intervalDays: "90",
      allowedWeekdays: [],
      buildsUp: false,
    });
  });

  it("uses the API's name for an entry the app does not know", () => {
    expect(formFromEntry({ ...entry, id: "clean_sauna", name: "Clean the sauna" }, english).name).toBe("Clean the sauna");
  });
});
