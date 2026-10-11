import { describe, expect, it } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { problemText } from "./problemText";

function english(problem: Parameters<typeof problemText>[0]): string {
  const { key, params } = problemText(problem);
  return enUS[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name]));
}

describe("problemText", () => {
  it("keeps the connection wording only for an API failure", () => {
    expect(problemText({ kind: "error" }).key).toBe("reminders.problem.error");
    expect(english({ kind: "error" })).toMatch(/connection/i);
  });

  it("asks the person to sign in again, without blaming the connection", () => {
    expect(problemText({ kind: "not-signed-in" }).key).toBe("reminders.problem.notSignedIn");
    const text = english({ kind: "not-signed-in" });
    expect(text).toMatch(/sign in/i);
    expect(text).not.toMatch(/connection/i);
  });

  it.each(["AbortError", "NotSupportedError"])("blames the notification service, not the connection, for %s", (name) => {
    expect(problemText({ kind: "browser-error", name }).key).toBe("reminders.problem.browserRegister");
    const text = english({ kind: "browser-error", name });
    expect(text).toContain("could not register with its notification service");
    expect(text).toContain("Google Play services");
    expect(text).not.toMatch(/connection/i);
  });

  it("points to Settings when the browser says notifications are not allowed", () => {
    expect(problemText({ kind: "browser-error", name: "NotAllowedError" }).key).toBe(
      "reminders.problem.browserNotAllowed",
    );
    const text = english({ kind: "browser-error", name: "NotAllowedError" });
    expect(text).toContain("Settings, Apps, Homeowner, Notifications");
    expect(text).not.toMatch(/connection/i);
  });

  it.each(["InvalidStateError", "SomethingElse", "unknown"])("shows the name %s in the generic text", (name) => {
    expect(problemText({ kind: "browser-error", name })).toEqual({
      key: "reminders.problem.browserRefused",
      params: { name },
    });
    expect(english({ kind: "browser-error", name })).toBe(`Your browser refused to turn on reminders (${name}).`);
  });

  it.each([
    ["denied", "reminders.problem.denied"],
    ["dismissed", "reminders.problem.dismissed"],
    ["not-configured", "reminders.problem.notConfigured"],
  ] as const)("maps %s to %s", (kind, key) => {
    expect(problemText({ kind }).key).toBe(key);
  });
});
