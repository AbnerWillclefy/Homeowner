import type { TestResult } from "../api/push";
import type { MessageKey } from "../i18n";

/** How long the API waits before sending the delayed test, so the app can be closed first. */
export const DELAYED_TEST_SECONDS = 10;

/** A catalog key and the values for its placeholders. Keys, never text, so the language is chosen at render. */
export interface Text {
  key: MessageKey;
  params?: Record<string, string | number>;
}

const FAILURE_KEY: Record<Exclude<TestResult["kind"], "ok">, MessageKey> = {
  "not-signed-in": "reminders.test.notSignedIn",
  unknown: "reminders.test.unknown",
  gone: "reminders.test.gone",
  "push-service-error": "reminders.test.pushServiceError",
  error: "reminders.test.error",
};

/** What to show once the API has answered. */
export function testStatusText(result: TestResult, delaySeconds?: number): Text {
  if (result.kind !== "ok") return { key: FAILURE_KEY[result.kind] };
  return { key: delaySeconds ? "reminders.test.okDelayed" : "reminders.test.ok" };
}

/** What to show while a delayed test is waiting on the API; null when there is nothing to add. */
export function testPendingText(delaySeconds: number | undefined): Text | null {
  return delaySeconds ? { key: "reminders.testPending", params: { seconds: delaySeconds } } : null;
}

export function delayedTestLabel(sending: boolean): Text {
  return sending
    ? { key: "reminders.sendingTest" }
    : { key: "reminders.sendDelayed", params: { seconds: DELAYED_TEST_SECONDS } };
}
