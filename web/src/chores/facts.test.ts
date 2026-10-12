import { describe, expect, it } from "vitest";
import type { Translate } from "../i18n";
import { enUS } from "../i18n/catalogs/en-US";
import { choreFacts, choreScheduleFacts } from "./facts";

const t: Translate = (key, params) => {
  let text = String(enUS[key]);
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
};

const CHORE = {
  name: "Put out the trash",
  category: "trash",
  demands: [],
  baseEffort: 1,
  importance: "essential",
  people: 1,
  intervalDays: 7,
  allowedWeekdays: [5, 2],
  buildsUp: false,
};

describe("choreScheduleFacts", () => {
  it("lists everything after the Category, with limited weekdays in display order", () => {
    expect(choreScheduleFacts(CHORE, t, "en-US")).toEqual([
      "Effort 1 of 5",
      "Essential",
      "1 person",
      "Every 7 days",
      "Only on Tuesday, Friday",
    ]);
  });

  it("words one-off, daily and building-up Chores", () => {
    expect(choreScheduleFacts({ ...CHORE, intervalDays: null, allowedWeekdays: [] }, t, "en-US")).toEqual([
      "Effort 1 of 5",
      "Essential",
      "1 person",
      "One-off",
    ]);
    expect(choreScheduleFacts({ ...CHORE, intervalDays: 1, allowedWeekdays: [], buildsUp: true }, t, "en-US")).toEqual([
      "Effort 1 of 5",
      "Essential",
      "1 person",
      "Every day",
      "Builds up while undone",
    ]);
  });

  it("is what choreFacts lists after the Category", () => {
    expect(choreFacts(CHORE, t, "en-US")).toEqual(["Trash", ...choreScheduleFacts(CHORE, t, "en-US")]);
  });
});

describe("choreFacts", () => {
  it("lists the facts, with limited weekdays in display order", () => {
    expect(choreFacts(CHORE, t, "en-US")).toEqual([
      "Trash",
      "Effort 1 of 5",
      "Essential",
      "1 person",
      "Every 7 days",
      "Only on Tuesday, Friday",
    ]);
  });

  it("words a daily, a one-off and a building-up Chore", () => {
    expect(choreFacts({ ...CHORE, intervalDays: 1, allowedWeekdays: [], buildsUp: true }, t, "en-US")).toEqual([
      "Trash",
      "Effort 1 of 5",
      "Essential",
      "1 person",
      "Every day",
      "Builds up while undone",
    ]);
    expect(choreFacts({ ...CHORE, intervalDays: null, allowedWeekdays: [] }, t, "en-US")[4]).toBe("One-off");
  });
});
