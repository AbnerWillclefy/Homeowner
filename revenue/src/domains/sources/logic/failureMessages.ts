import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { ConnectProblem } from "./connectFlow";

/** Calm wording for every problem on the screen. A new failure kind fails the typecheck here until it has a message. */
export const FAILURE_KEY: Record<ConnectProblem, MessageKey> = {
  offline: "sources.error.offline",
  error: "sources.error.generic",
  "not-signed-in": "sources.error.notSignedIn",
  rejected: "sources.error.rejected",
  "item-refused": "sources.error.itemRefused",
  "no-credentials": "sources.error.noCredentials",
  unavailable: "sources.error.unavailable",
  widget: "sources.error.widget",
};
