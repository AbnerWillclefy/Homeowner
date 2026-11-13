import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { RemindersResult } from "./reminders";

/** Anything that stops notifications from turning on, as shown to the User. */
export type RemindersProblem = Exclude<RemindersResult, { kind: "enabled" }>;

/** Catalog key per problem, and the values for its placeholders. Never the browser's message, only its error name. */
export function problemText(problem: RemindersProblem): { key: MessageKey; params?: { name: string } } {
  switch (problem.kind) {
    case "denied":
      return { key: "notify.problem.denied" };
    case "dismissed":
      return { key: "notify.problem.dismissed" };
    case "not-configured":
      return { key: "notify.problem.notConfigured" };
    case "not-signed-in":
      return { key: "notify.problem.notSignedIn" };
    case "error":
      return { key: "notify.problem.error" };
    case "browser-error":
      return problem.name === "AbortError" || problem.name === "NotSupportedError"
        ? { key: "notify.problem.browserRegister" }
        : problem.name === "NotAllowedError"
          ? { key: "notify.problem.browserNotAllowed" }
          : { key: "notify.problem.browserRefused", params: { name: problem.name } };
  }
}
