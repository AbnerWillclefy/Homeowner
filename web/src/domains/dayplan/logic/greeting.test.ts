import { describe, expect, it } from "vitest";
import { greetingKey } from "./greeting";

describe("greetingKey", () => {
  it.each([
    [0, "morning"],
    [11, "morning"],
    [12, "afternoon"],
    [17, "afternoon"],
    [18, "evening"],
    [23, "evening"],
  ])("hour %i is %s", (hour, period) => {
    expect(greetingKey(hour)).toBe(`dayplan.greeting.${period}`);
  });

  it.each([
    [0, "morning"],
    [12, "afternoon"],
    [18, "evening"],
  ])("hour %i is %sName when there is a name", (hour, period) => {
    expect(greetingKey(hour, true)).toBe(`dayplan.greeting.${period}Name`);
  });

  it("falls back to the evening greeting with a name for an invalid hour", () => {
    expect(greetingKey(NaN, true)).toBe("dayplan.greeting.eveningName");
  });

  it.each([NaN, -1, 24, 7.5, Infinity])("does not throw for %s and falls back to evening", (hour) => {
    expect(greetingKey(hour)).toBe("dayplan.greeting.evening");
  });
});
