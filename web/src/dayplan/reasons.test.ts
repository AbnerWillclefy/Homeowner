import { describe, expect, it } from "vitest";
import { assignmentReasonLabel, poolReasonLabel } from "./reasons";

describe("poolReasonLabel", () => {
  it("points at a catalog key for each reason id the API sends", () => {
    for (const id of [
      "no_energy_left",
      "restricted_for_all",
      "weekday_not_allowed",
      "two_person_deferred",
      "invalid_effort",
      "added_after_plan",
      "refused",
    ]) {
      expect(poolReasonLabel(id)).toEqual({ key: `dayplan.pool.reason.${id}` });
    }
  });

  it("shows nothing for a Task with no reason, and the id for one the app does not know", () => {
    expect(poolReasonLabel(undefined)).toBeNull();
    expect(poolReasonLabel("")).toBeNull();
    expect(poolReasonLabel("something_new")).toEqual({ text: "something_new" });
  });
});

describe("assignmentReasonLabel", () => {
  it("points at a catalog key for each reason id the API sends", () => {
    for (const id of ["deadline_today", "importance", "lateness", "fits_energy", "taken"]) {
      expect(assignmentReasonLabel(id)).toEqual({ key: `dayplan.assigned.reason.${id}` });
    }
  });

  it("falls back like the pool does", () => {
    expect(assignmentReasonLabel(undefined)).toBeNull();
    expect(assignmentReasonLabel("other")).toEqual({ text: "other" });
  });
});
