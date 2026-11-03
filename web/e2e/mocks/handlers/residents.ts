import { avatarFor, json, shownName, signedIn, type FakeApi, type FakeState, type FakeCompletion, type FakeResident } from "../api";
import { FAKE_NOW, FAKE_TODAY } from "./today";

const DAY_MS = 86_400_000;

/** The Home's local date of an instant, YYYY-MM-DD, the way the API groups Completions. */
function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.parse(iso));
}

/** The thirty local dates ending at today, as the API's window: today and 29 before. */
function windowStart(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - 29 * DAY_MS).toISOString().slice(0, 10);
}

/** Completions in the window grouped into days, newest day first and oldest first within a day. */
function groupByDay(completions: FakeCompletion[], timeZone: string) {
  const from = windowStart(FAKE_TODAY);
  const inWindow = completions
    .map((completion) => ({ completion, date: localDate(completion.completedAt, timeZone) }))
    .filter(({ date }) => date >= from && date <= FAKE_TODAY)
    .sort((a, b) => (a.date === b.date ? a.completion.completedAt.localeCompare(b.completion.completedAt) : b.date.localeCompare(a.date)));
  const days: { date: string; completions: unknown[] }[] = [];
  for (const { completion, date } of inWindow) {
    const { id, choreName, category, completedAt, with: partners } = completion;
    const row = { id, choreId: `chore-of-${id}`, choreName, category, completedAt, with: partners ?? [] };
    const last = days[days.length - 1];
    if (last?.date === date) last.completions.push(row);
    else days.push({ date, completions: [row] });
  }
  return { days, count: inWindow.length };
}

/** `GET /home/residents/{id}`'s body for one Resident. */
function detailOf(resident: FakeResident, timeZone: string) {
  const { days, count } = groupByDay(resident.completions ?? [], timeZone);
  return {
    date: FAKE_TODAY,
    id: resident.id,
    you: resident.you,
    name: resident.name,
    photoUrl: resident.photoUrl,
    ...avatarFor(resident.name),
    streak: resident.streak ?? 0,
    doneLast30Days: count,
    days,
  };
}

/**
 * `GET /home/residents`: `{date, residents}` with the Home's Residents, their shown names, avatar fallback, Streak
 * and done-today count, and no emails or user ids. Without `state.residents` it lists only the caller, so a spec
 * that does not care about housemates still gets a valid answer. 404 without a Home.
 *
 * `GET /home/residents/{id}`: one of those Residents with their Streak, the number of Completions in the last 30
 * local days and those Completions grouped by day (from `FakeResident.completions`, in the Home's time zone). An
 * id that is not in the list is `404 resident not found`, like the API; 404 `no home` without a Home.
 *
 * `PATCH /home/completions/{id}`: moves one of the caller's Completions (see the rules below), against the clock
 * `FAKE_NOW` and the Home's zone.
 */
export function residentsHandlers(api: FakeApi): void {
  const list = (state: FakeState): FakeResident[] => {
    const { email, displayName, photoUrl } = state.user;
    const caller: FakeResident = { id: "resident-1", you: true, name: shownName({ email, displayName }), photoUrl: photoUrl ?? null, completions: state.callerCompletions };
    return state.residents ?? [caller];
  };

  api.on(
    "GET /home/residents",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const residents = list(state).map((resident) => ({
        id: resident.id,
        you: resident.you,
        name: resident.name,
        photoUrl: resident.photoUrl,
        ...avatarFor(resident.name),
        streak: resident.streak ?? 0,
        doneToday: resident.doneToday ?? 0,
      }));
      return json(200, { date: FAKE_TODAY, residents });
    }),
  );

  api.on(
    "GET /home/residents/{id}",
    signedIn((request, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const resident = list(state).find((row) => row.id === request.params["id"]);
      if (resident === undefined) return json(404, { error: "resident not found" });
      return json(200, detailOf(resident, state.home.timezone));
    }),
  );

  // The server's rules for moving a Completion (backend/internal/dayplan/redate.go), in its order: unknown, not yours,
  // in the future, before today-29 in the Home's zone, before the Task's window. On success the state changes, so
  // later reads agree: the Completion is on its new day, and Today's Done list drops it when it left today.
  api.on(
    "PATCH /home/completions/{id}",
    signedIn((request, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const id = request.params["id"];
      const everyone = list(state);
      const caller = everyone.find((resident) => resident.you);
      const completion = everyone.flatMap((resident) => resident.completions ?? []).find((row) => row.id === id);
      if (caller === undefined || completion === undefined) return json(404, { error: "completion not found" });
      if (!(caller.completions ?? []).some((row) => row.id === id)) return json(409, { error: "not_yours" });

      const body = typeof request.body === "object" && request.body !== null ? (request.body as Record<string, unknown>) : {};
      const raw = body["completedAt"];
      if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(raw) || Number.isNaN(Date.parse(raw))) {
        return json(400, { error: "invalid_completed_at" });
      }
      const at = new Date(raw).toISOString();
      const date = localDate(at, state.home.timezone);
      if (Date.parse(at) > Date.parse(FAKE_NOW)) return json(400, { error: "in_future" });
      if (date < windowStart(FAKE_TODAY)) return json(400, { error: "too_old" });
      if (completion.windowStart !== undefined && date < completion.windowStart) return json(400, { error: "before_task" });

      completion.completedAt = at;
      const done = state.dayPlan?.doneToday ?? [];
      const shown = done.findIndex((item) => item.completionId === id);
      if (shown >= 0 && date === FAKE_TODAY) done[shown]!.completedAt = at;
      else if (shown >= 0) done.splice(shown, 1);
      return json(200, detailOf(caller, state.home.timezone));
    }),
  );
}
