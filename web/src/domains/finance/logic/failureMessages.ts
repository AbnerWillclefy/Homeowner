import type { MessageKey } from "../../../shared/i18n";
import type { ConnectProblem } from "./connectFlow";

/** Calm wording for every problem on the Finances tab. A new failure kind fails the typecheck here until it has a message. */
export const FINANCE_FAILURE_KEY: Record<ConnectProblem, MessageKey> = {
  offline: "finances.error.offline",
  error: "finances.error.generic",
  "not-signed-in": "home.notSignedIn",
  invalid: "finances.error.invalid",
  rejected: "finances.error.rejected",
  "item-refused": "finances.error.itemRefused",
  "no-credentials": "finances.error.noCredentials",
  unavailable: "finances.error.unavailable",
  widget: "finances.error.widget",
};
