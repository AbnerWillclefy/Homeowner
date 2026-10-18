import type { TestInfo } from "@playwright/test";

/** An address unique to this test, worker and repeat, so parallel and repeated runs can never clash even if state leaked. */
export function uniqueEmail(info: TestInfo): string {
  const slug = info.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
  return `${slug}-w${info.workerIndex}-r${info.repeatEachIndex}@example.test`;
}

// Obviously fake passwords: the trace keeps request bodies on failure, so never use a real one here.
/** Meets the build's policy (10 characters, lower case, upper case, a number). */
export const GOOD_PASSWORD = "Fake-Passw0rd-e2e";
/** Breaks the policy: too short, no number. */
export const WEAK_PASSWORD = "short";
