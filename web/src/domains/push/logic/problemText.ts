import type { RemindersResult } from "./reminders";
import type { MessageKey } from "../../../shared/i18n";

/** A catalog key and the values for its placeholders. Keys, never text, so the language is chosen at render. */
export interface Text {
  key: MessageKey;
  params?: Record<string, string | number>;
}

/** Anything that stops reminders from turning on, as shown to the user. */
export type RemindersProblem = Exclude<RemindersResult, { kind: "enabled" }>;

/** Plain wording per problem. Never includes the browser's error message, only its name. */
export function problemText(problem: RemindersProblem): Text {
  switch (problem.kind) {
    case "denied":
      return { key: "reminders.problem.denied" };
    case "dismissed":
      return { key: "reminders.problem.dismissed" };
    case "not-configured":
      return { key: "reminders.problem.notConfigured" };
    case "not-signed-in":
      return { key: "reminders.problem.notSignedIn" };
    case "error":
      return { key: "reminders.problem.error" };
    case "browser-error":
      switch (problem.name) {
        case "AbortError":
        case "NotSupportedError":
          return { key: "reminders.problem.browserRegister" };
        case "NotAllowedError":
          return { key: "reminders.problem.browserNotAllowed" };
        default:
          return { key: "reminders.problem.browserRefused", params: { name: problem.name } };
      }
  }
}
