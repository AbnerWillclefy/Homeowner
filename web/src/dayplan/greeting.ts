import type { MessageKey } from "../i18n";

export type GreetingPeriod = "morning" | "afternoon" | "evening";

export const GREETING_KEYS = {
  morning: "dayplan.greeting.morning",
  afternoon: "dayplan.greeting.afternoon",
  evening: "dayplan.greeting.evening",
} as const satisfies Record<GreetingPeriod, MessageKey>;

/**
 * The part of the day for an hour of the device's local clock: before 12 is morning, 12 to 17 afternoon, 18 on
 * evening. Anything that is not a whole hour from 0 to 23 reads as evening rather than throwing.
 */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "evening";
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

export const greetingKey = (hour: number): (typeof GREETING_KEYS)[GreetingPeriod] =>
  GREETING_KEYS[greetingPeriod(hour)];
