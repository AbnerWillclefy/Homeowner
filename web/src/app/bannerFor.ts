import type { MessageKey } from "../i18n";
import type { HealthState } from "./useHealth";

/** The banner's message, or null when nothing about health should show (still checking, or healthy). */
export function bannerFor(health: HealthState): MessageKey | null {
  switch (health.kind) {
    case "unavailable":
      return "health.unavailable";
    case "unreachable":
      return "health.unreachable";
    default:
      return null;
  }
}
