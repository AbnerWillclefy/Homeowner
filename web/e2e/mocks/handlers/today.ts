import type { CheckIn, Level } from "../../../src/domains/checkin/api/api";
import type { DayPlan } from "../../../src/domains/dayplan/api/api";
import { json, signedIn, type FakeApi } from "../api";

/** A fixed day, so nothing here depends on the clock. */
export const FAKE_TODAY = "2030-01-15";

/**
 * What `GET /home/check-in` answers when a spec sets none: a Check-in already saved, so the Check-in dialog (which
 * opens by itself on an unchecked day) does not cover every screen. A spec about an unchecked day sets
 * `fakeState.checkIn` to `uncheckedDay()`.
 */
const CHECKED_IN: CheckIn = { date: FAKE_TODAY, checkedIn: true, level: "normal", restrictions: [] };

/** A day with no Check-in yet: the pill is dashed and the dialog opens on launch. */
export function uncheckedDay(date: string = FAKE_TODAY): CheckIn {
  return { date, checkedIn: false, level: null, restrictions: [] };
}

/** The Energy the fake plans for each level, so a spec can tell a saved Check-in from the one it replaced. */
const ENERGY_OF_LEVEL: Record<Level, number> = { drained: 0, low: 4, normal: 9, energized: 14 };

// Type-only imports from the app: a value import pulls in its config, which reads `import.meta.env` that Node lacks.
const isLevel = (value: unknown): value is Level => typeof value === "string" && Object.hasOwn(ENERGY_OF_LEVEL, value);

/**
 * What Today reads as soon as it mounts: the Check-in, the Day Plan and the Streak. With nothing in the state they
 * answer a checked-in day nobody has planned yet; a spec that needs more sets `state.checkIn` or `state.dayPlan`. Both need a
 * Home, like the API (404 without one).
 */
export function todayHandlers(api: FakeApi): void {
  api.on(
    "GET /home/check-in",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      return json(200, state.checkIn ?? CHECKED_IN);
    }),
  );

  // A saved Check-in replaces today's, and the planned day is made again for the level: the next read of the Day
  // Plan carries the Energy of that level (the real API plans the Resident again).
  api.on(
    "PUT /home/check-in",
    signedIn((request, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const body = typeof request.body === "object" && request.body !== null ? (request.body as Record<string, unknown>) : {};
      const level = body["level"];
      if (!isLevel(level)) return json(400, { error: "invalid" });
      const restrictions = Array.isArray(body["restrictions"]) ? body["restrictions"].filter((id): id is string => typeof id === "string") : [];
      state.checkIn = { date: FAKE_TODAY, checkedIn: true, level, restrictions };
      if (state.dayPlan) state.dayPlan = { ...state.dayPlan, energy: ENERGY_OF_LEVEL[level] };
      return json(200, state.checkIn);
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
