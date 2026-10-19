import type { MessageKey } from "../../../shared/i18n";

type GreetingPeriod = "morning" | "afternoon" | "evening";

const GREETING_KEYS = {
  morning: "dayplan.greeting.morning",
  afternoon: "dayplan.greeting.afternoon",
  evening: "dayplan.greeting.evening",
} as const satisfies Record<GreetingPeriod, MessageKey>;

// The same greetings with a `{name}` slot, used once the Resident's name is known.
const NAME_KEYS = {
  morning: "dayplan.greeting.morningName",
  afternoon: "dayplan.greeting.afternoonName",
  evening: "dayplan.greeting.eveningName",
} as const satisfies Record<GreetingPeriod, MessageKey>;

function periodOf(hour: number): GreetingPeriod {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "evening";
  if (hour < 12) return "morning";
  return hour < 18 ? "afternoon" : "evening";
}

/**
 * The greeting message for an hour of the device's local clock: before 12 is morning, 12 to 17 afternoon, 18 on
 * evening. Anything that is not a whole hour from 0 to 23 reads as evening rather than throwing. With `hasName`
 * it is the variant that takes a `{name}`; without one (the name is still loading or failed) it is the plain
 * greeting, so the line never waits on a second call.
 */
export function greetingKey(hour: number, hasName = false) {
  const period = periodOf(hour);
  return hasName ? NAME_KEYS[period] : GREETING_KEYS[period];
}
