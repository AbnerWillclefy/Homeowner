import { describe, expect, it } from "vitest";
import type { Translate } from "../../../shared/i18n";
import { enUS } from "../../../shared/i18n/catalogs/en-US";
import { taskEffortText } from "./taskEffort";

const t: Translate = (key, params) => {
  let text = String(enUS[key]);
  for (const [name, value] of Object.entries(params ?? {})) text = text.replace(`{${name}}`, String(value));
  return text;
};

describe("taskEffortText", () => {
  it("names the level of a Task that has not grown", () => {
    expect(taskEffortText(t, 3, 3)).toBe("Effort: Medium");
  });

  it("names both levels once the Task has grown above its base", () => {
    expect(taskEffortText(t, 4, 2)).toBe("Effort: Heavy, usually Light");
    expect(taskEffortText(t, 5, 1)).toBe("Effort: Very heavy, usually Very light");
  });
});
