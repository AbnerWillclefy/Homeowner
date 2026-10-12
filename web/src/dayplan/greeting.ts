import type { MessageKey } from "../shared/i18n";

type GreetingPeriod = "morning" | "afternoon" | "evening";

const GREETING_KEYS = {
  morning: "dayplan.greeting.morning",
  afternoon: "dayplan.greeting.afternoon",
  evening: "dayplan.greeting.evening",
} as const satisfies Record<GreetingPeriod, MessageKey>;

/**
 * The greeting message for an hour of the device's local clock: before 12 is morning, 12 to 17 afternoon, 18 on
 * evening. Anything that is not a whole hour from 0 to 23 reads as evening rather than throwing.
 */
export function greetingKey(hour: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return GREETING_KEYS.evening;
  if (hour < 12) return GREETING_KEYS.morning;
  return hour < 18 ? GREETING_KEYS.afternoon : GREETING_KEYS.evening;
}
