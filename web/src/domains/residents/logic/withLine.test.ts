import { describe, expect, it } from "vitest";
import type { Translate } from "../../../shared/i18n";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import type { Resident } from "../api/api";
import { withLine } from "./withLine";

const t: Translate = (key, params) => {
  let text = String(enUS[key]);
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
};

const resident = (over: Partial<Resident>): Resident => ({ residentId: "r1", userId: "u1", name: "Ana", photoUrl: null, me: false, ...over });

describe("withLine", () => {
  it("says who a housemate is", () => {
    expect(withLine(t, resident({}))).toBe(t("dayplan.task.with", { name: "Ana" }));
    expect(withLine(t, resident({}))).toContain("Ana");
  });

  it("says you for the caller", () => {
    expect(withLine(t, resident({ me: true }))).toBe(enUS["dayplan.task.withYou"]);
  });

  it("uses a placeholder while the Resident is unknown", () => {
    expect(withLine(t, undefined)).toBe(enUS["dayplan.task.withSomeone"]);
  });
});
