import { WEEKDAYS, type Baseline } from "../profile/api";

/** True when every one of the seven days has a value. 0 is a value; only an unset day counts as missing. */
export function allBaselineDaysSet(baseline: Baseline): boolean {
  return WEEKDAYS.every((day) => baseline[day] !== null);
}
