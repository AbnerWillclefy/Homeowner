import { describe, expect, it } from "vitest";
import { problemText } from "./problemText";

describe("problemText", () => {
  it("keeps the connection wording only for an API failure", () => {
    expect(problemText({ kind: "error" })).toMatch(/connection/i);
  });

  it("asks the person to sign in again, without blaming the connection", () => {
    const text = problemText({ kind: "not-signed-in" });
    expect(text).toMatch(/sign in/i);
    expect(text).not.toMatch(/connection/i);
  });

  it.each(["AbortError", "NotSupportedError"])("blames the notification service, not the connection, for %s", (name) => {
    const text = problemText({ kind: "browser-error", name });
    expect(text).toContain("could not register with its notification service");
    expect(text).toContain("Google Play services");
    expect(text).not.toMatch(/connection/i);
  });

  it("points to Settings when the browser says notifications are not allowed", () => {
    const text = problemText({ kind: "browser-error", name: "NotAllowedError" });
    expect(text).toContain("Settings, Apps, Homeowner, Notifications");
    expect(text).not.toMatch(/connection/i);
  });

  it.each(["InvalidStateError", "SomethingElse", "unknown"])("shows the name %s in the generic text", (name) => {
    const text = problemText({ kind: "browser-error", name });
    expect(text).toBe(`Your browser refused to turn on reminders (${name}).`);
  });
});
