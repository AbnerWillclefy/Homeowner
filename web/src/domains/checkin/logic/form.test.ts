import { describe, expect, it } from "vitest";
import type { CheckIn } from "../api/api";
import { emptyForm, formFrom, submission, toggledRestriction } from "./form";

const DEMANDS = ["heavy_lifting", "bending", "heights", "strong_chemicals"];
const MISSING: CheckIn = { date: "2026-10-12", checkedIn: false, level: null, restrictions: [] };
const LOW: CheckIn = { date: "2026-10-12", checkedIn: true, level: "low", restrictions: ["bending"] };

describe("check-in form", () => {
  it("starts with no level chosen, so nothing is assumed about the person's day", () => {
    expect(emptyForm()).toEqual({ level: null, restrictions: [] });
    expect(formFrom(MISSING)).toEqual({ level: null, restrictions: [] });
  });

  it("starts from today's Check-in when changing it", () => {
    expect(formFrom(LOW)).toEqual({ level: "low", restrictions: ["bending"] });
  });

  it("cannot be submitted without a level", () => {
    expect(submission({ level: null, restrictions: ["bending"] }, DEMANDS)).toEqual({ ok: false, error: "level-required" });
  });

  it("sends the chosen level and the ticked Demands in the order of the list", () => {
    expect(submission({ level: "energized", restrictions: ["heights", "bending"] }, DEMANDS)).toEqual({
      ok: true,
      level: "energized",
      restrictions: ["bending", "heights"],
    });
  });

  it("sends no Restrictions when none are ticked, and drops ids the list no longer has", () => {
    expect(submission({ level: "normal", restrictions: [] }, DEMANDS)).toEqual({ ok: true, level: "normal", restrictions: [] });
    expect(submission({ level: "normal", restrictions: ["flying"] }, DEMANDS)).toEqual({
      ok: true,
      level: "normal",
      restrictions: [],
    });
  });

  it("toggles a Restriction on and off", () => {
    expect(toggledRestriction(["bending"], "heights")).toEqual(["bending", "heights"]);
    expect(toggledRestriction(["bending", "heights"], "bending")).toEqual(["heights"]);
  });
});
