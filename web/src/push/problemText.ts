import type { RemindersResult } from "./reminders";

/** Anything that stops reminders from turning on, as shown to the user. */
export type RemindersProblem = Exclude<RemindersResult, { kind: "enabled" }>;

const BLOCKED =
  "Notifications are blocked for Homeowner. Open your phone's Settings, find Homeowner under Notifications, allow them, then come back. The app cannot ask a second time.";

/** Plain wording per problem. Never includes the browser's error message, only its name. */
export function problemText(problem: RemindersProblem): string {
  switch (problem.kind) {
    case "denied":
      return BLOCKED;
    case "dismissed":
      return "You closed the permission question without answering. Tap the button to try again when you are ready.";
    case "not-configured":
      return "Reminders are not set up on the service yet. Try again later.";
    case "not-signed-in":
      return "You are not signed in any more. Sign in again, then turn on reminders.";
    case "error":
      return "Something went wrong turning on reminders. Check your connection and try again.";
    case "browser-error":
      switch (problem.name) {
        case "AbortError":
        case "NotSupportedError":
          return "This browser could not register with its notification service. Use Chrome and make sure Google Play services is up to date.";
        case "NotAllowedError":
          return "Notifications are not allowed for this app. Check Settings, Apps, Homeowner, Notifications.";
        default:
          return `Your browser refused to turn on reminders (${problem.name}).`;
      }
  }
}
