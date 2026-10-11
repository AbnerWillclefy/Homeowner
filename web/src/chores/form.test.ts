import { describe, expect, it } from "vitest";
import type { Chore } from "../api/chores";
import { emptyForm, formFromChore, toChoreInput, toggled, type ChoreFormState } from "./form";

const FORM: ChoreFormState = {
  name: "Wash dishes",
  category: "kitchen",
  demands: ["bending"],
  baseEffort: 2,
  importance: "normal",
  people: 1,
  intervalDays: "3",
  allowedWeekdays: [3, 1],
  buildsUp: true,
};

describe("toChoreInput", () => {
  it("sends a repeating Chore with its interval as a number and its weekdays sorted", () => {
    expect(toChoreInput(FORM)).toEqual({
      name: "Wash dishes",
      category: "kitchen",
      demands: ["bending"],
      baseEffort: 2,
      importance: "normal",
      people: 1,
      intervalDays: 3,
      allowedWeekdays: [1, 3],
      buildsUp: true,
    });
  });

  it("reads a blank interval as one-off", () => {
    expect(toChoreInput({ ...FORM, intervalDays: "" }).intervalDays).toBeNull();
    expect(toChoreInput({ ...FORM, intervalDays: "   " }).intervalDays).toBeNull();
  });

  it("sends Sunday as 0 and Saturday as 6, once each", () => {
    expect(toChoreInput({ ...FORM, allowedWeekdays: [6, 0, 6] }).allowedWeekdays).toEqual([0, 6]);
  });

  it("passes an interval that is not a whole number through for the API to reject", () => {
    expect(toChoreInput({ ...FORM, intervalDays: "2.5" }).intervalDays).toBe(2.5);
    expect(toChoreInput({ ...FORM, intervalDays: "soon" }).intervalDays).toBe("soon");
  });

  it("does not trim or alter the name, so the API's answer is about what was typed", () => {
    expect(toChoreInput({ ...FORM, name: "  " }).name).toBe("  ");
  });

  it("does not change the form's own lists", () => {
    const weekdays = [3, 1];
    toChoreInput({ ...FORM, allowedWeekdays: weekdays });
    expect(weekdays).toEqual([3, 1]);
  });
});

describe("formFromChore", () => {
  const chore: Chore = { ...toChoreInput(FORM), id: "c1", intervalDays: null };

  it("shows a one-off Chore with a blank interval", () => {
    expect(formFromChore(chore).intervalDays).toBe("");
  });

  it("shows a repeating Chore's interval as text", () => {
    expect(formFromChore({ ...chore, intervalDays: 7 }).intervalDays).toBe("7");
  });

  it("round-trips back to the same request", () => {
    const stored: Chore = { ...chore, intervalDays: 3, allowedWeekdays: [1, 3] };
    const { id: _id, ...input } = stored;
    expect(toChoreInput(formFromChore(stored))).toEqual(input);
  });
});

describe("emptyForm", () => {
  it("starts a one-person, one-off Chore of normal Importance with nothing chosen", () => {
    expect(emptyForm()).toMatchObject({
      name: "",
      category: "",
      demands: [],
      importance: "normal",
      people: 1,
      intervalDays: "",
      allowedWeekdays: [],
      buildsUp: false,
    });
  });
});

describe("toggled", () => {
  it("adds a missing value and removes a present one without changing the original", () => {
    const list = [1, 2];
    expect(toggled(list, 3)).toEqual([1, 2, 3]);
    expect(toggled(list, 1)).toEqual([2]);
    expect(list).toEqual([1, 2]);
  });
});
