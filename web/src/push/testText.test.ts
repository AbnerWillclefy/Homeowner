import { describe, expect, it } from "vitest";
import { enUS } from "../i18n/catalogs/en-US";
import { DELAYED_TEST_SECONDS, delayedTestLabel, testPendingText, testStatusText } from "./testText";

describe("testStatusText", () => {
  it("keeps the original wording for an immediate test", () => {
    const { key } = testStatusText({ kind: "ok" });
    expect(enUS[key]).toBe("Test notification sent. It should arrive in a few seconds.");
  });

  it("does not promise a few more seconds once a delayed test has been sent", () => {
    const { key } = testStatusText({ kind: "ok" }, DELAYED_TEST_SECONDS);
    expect(enUS[key]).toBe("Test notification sent.");
  });

  it("asks the person to sign in again when the session is gone", () => {
    expect(testStatusText({ kind: "not-signed-in" }).key).toBe("reminders.test.notSignedIn");
  });

  it.each([
    ["unknown", "reminders.test.unknown"],
    ["gone", "reminders.test.gone"],
    ["push-service-error", "reminders.test.pushServiceError"],
  ] as const)("maps %s to %s", (kind, key) => {
    expect(testStatusText({ kind }).key).toBe(key);
  });

  it("explains failures the same way for a delayed test", () => {
    const { key } = testStatusText({ kind: "error" }, DELAYED_TEST_SECONDS);
    expect(key).toBe("reminders.test.error");
    expect(enUS[key]).toMatch(/connection/i);
  });
});

describe("testPendingText", () => {
  it("tells the user to close the app while a delayed test waits", () => {
    expect(testPendingText(DELAYED_TEST_SECONDS)).toEqual({
      key: "reminders.testPending",
      params: { seconds: 10 },
    });
  });

  it("says nothing for an immediate test", () => {
    expect(testPendingText(undefined)).toBeNull();
  });
});

describe("delayedTestLabel", () => {
  it("names the button", () => {
    expect(delayedTestLabel(false)).toEqual({ key: "reminders.sendDelayed", params: { seconds: 10 } });
  });

  it("shows progress while sending", () => {
    expect(delayedTestLabel(true)).toEqual({ key: "reminders.sendingTest" });
  });
});
