import type { TestResult } from "../api/push";

/** How long the API waits before sending the delayed test, so the app can be closed first. */
export const DELAYED_TEST_SECONDS = 10;

const FAILURE_TEXT: Record<Exclude<TestResult["kind"], "ok">, string> = {
  "not-signed-in": "You are not signed in any more. Sign in again to send a test.",
  unknown: "The service does not know this device yet. Turn on reminders again.",
  gone: "Your phone's notification service rejected this device, so it was removed. Turn on reminders again.",
  "push-service-error": "The notification service could not deliver it right now. Try again in a moment.",
  error: "Could not reach the service. Check your connection and try again.",
};

/** What to show once the API has answered. */
export function testStatusText(result: TestResult, delaySeconds?: number): string {
  if (result.kind !== "ok") return FAILURE_TEXT[result.kind];
  return delaySeconds ? "Test notification sent." : "Test notification sent. It should arrive in a few seconds.";
}

/** What to show while a delayed test is waiting on the API; null when there is nothing to add. */
export function testPendingText(delaySeconds: number | undefined): string | null {
  return delaySeconds ? `Close the app now; the notification arrives in about ${delaySeconds} seconds.` : null;
}

export function delayedTestLabel(sending: boolean): string {
  return sending ? "Sending..." : `Send in ${DELAYED_TEST_SECONDS} seconds`;
}
