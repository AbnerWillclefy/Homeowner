import { describe, expect, it } from "vitest";
import { DELAYED_TEST_SECONDS, delayedTestLabel, testPendingText, testStatusText } from "./testText";

describe("testStatusText", () => {
  it("keeps the original wording for an immediate test", () => {
    expect(testStatusText({ kind: "ok" })).toBe("Test notification sent. It should arrive in a few seconds.");
  });

  it("does not promise a few more seconds once a delayed test has been sent", () => {
    expect(testStatusText({ kind: "ok" }, DELAYED_TEST_SECONDS)).toBe("Test notification sent.");
  });

  it("asks the person to sign in again when the session is gone", () => {
    expect(testStatusText({ kind: "not-signed-in" })).toMatch(/sign in/i);
  });

  it("explains failures the same way for a delayed test", () => {
    expect(testStatusText({ kind: "error" }, DELAYED_TEST_SECONDS)).toMatch(/connection/i);
  });
});

describe("testPendingText", () => {
  it("tells the user to close the app while a delayed test waits", () => {
    expect(testPendingText(DELAYED_TEST_SECONDS)).toBe(
      "Close the app now; the notification arrives in about 10 seconds.",
    );
  });

  it("says nothing for an immediate test", () => {
    expect(testPendingText(undefined)).toBeNull();
  });
});

describe("delayedTestLabel", () => {
  it("names the button", () => {
    expect(delayedTestLabel(false)).toBe("Send in 10 seconds");
  });

  it("shows progress while sending", () => {
    expect(delayedTestLabel(true)).toBe("Sending...");
  });
});
