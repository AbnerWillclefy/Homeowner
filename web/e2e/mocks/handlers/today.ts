import type { CheckIn } from "../../../src/domains/checkin/api/api";
import type { DayPlan } from "../../../src/domains/dayplan/api/api";
import { json, signedIn, type FakeApi } from "../api";

/** A fixed day, so nothing here depends on the clock. */
export const FAKE_TODAY = "2030-01-15";

/**
 * What Today reads as soon as it mounts: the Check-in, the Day Plan and the Streak. With nothing in the state they
 * answer a day nobody has planned yet; a spec that needs more sets `state.checkIn` or `state.dayPlan`. Both need a
 * Home, like the API (404 without one).
 */
export function todayHandlers(api: FakeApi): void {
  api.on(
    "GET /home/check-in",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const unchecked: CheckIn = { date: FAKE_TODAY, checkedIn: false, level: null, restrictions: [] };
      return json(200, state.checkIn ?? unchecked);
    }),
  );

  api.on(
    "GET /home/day-plan",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const unplanned: DayPlan = {
        date: FAKE_TODAY,
        allocationTime: state.home.allocationTime,
        planned: false,
        rejected: false,
        allocator: "",
        energy: null,
        mine: [],
        others: [],
        pool: [],
        doneToday: [],
        swaps: { incoming: [], outgoing: [] },
      };
      return json(200, state.dayPlan ?? unplanned);
    }),
  );

  api.on("GET /home/streak", signedIn((_, state) => (state.home === null ? json(404, { error: "no home" }) : json(200, { current: state.streak ?? 0, todayGrew: state.streakTodayGrew ?? false }))));
}
