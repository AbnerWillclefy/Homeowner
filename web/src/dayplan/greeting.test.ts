import { describe, expect, it } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { ptBR } from "../i18n/catalogs/pt-BR";
import { GREETING_KEYS, greetingKey, greetingPeriod } from "./greeting";

describe("greetingPeriod", () => {
  it.each([
    [0, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ])("hour %i is %s", (hour, period) => {
    expect(greetingPeriod(hour)).toBe(period);
  });

  it.each([NaN, -1, 24, 7.5, Infinity])("does not throw for %s and falls back to evening", (hour) => {
    expect(greetingPeriod(hour)).toBe("evening");
  });
});

describe("greetingKey", () => {
  it("maps the hour to the greeting message", () => {
    expect(greetingKey(9)).toBe("dayplan.greeting.morning");
    expect(greetingKey(13)).toBe("dayplan.greeting.afternoon");
    expect(greetingKey(20)).toBe("dayplan.greeting.evening");
  });

  it.each(Object.values(GREETING_KEYS))("%s has text in both languages", (key) => {
    expect(enUS[key].length).toBeGreaterThan(0);
    expect(ptBR[key].length).toBeGreaterThan(0);
  });
});
