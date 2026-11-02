import { avatarFor, json, shownName, signedIn, type FakeApi, type FakeState, type FakeCompletion, type FakeResident } from "../api";
import { FAKE_TODAY } from "./today";

const DAY_MS = 86_400_000;

/** The Home's local date of an instant, YYYY-MM-DD, the way the API groups Completions. */
function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.parse(iso));
}

/** The first of the `days` local dates ending at today: the API's window is 30 (today and 29 before). */
function windowStart(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** Completions of the last 30 local days grouped into days, newest day first and oldest first within a day. */
function groupByDay(completions: FakeCompletion[], timeZone: string) {
  const from = windowStart(FAKE_TODAY, 30);
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
  const last7 = windowStart(FAKE_TODAY, 7);
  return { days, count: inWindow.length, last7: inWindow.filter(({ date }) => date >= last7).length };
}

/**
 * `GET /home/residents`: `{date, residents}` with the Home's Residents, their shown names, avatar fallback, Streak
 * and done-today count, and no emails or user ids. Without `state.residents` it lists only the caller, so a spec
 * that does not care about housemates still gets a valid answer. 404 without a Home.
 *
 * `GET /home/residents/{id}`: one of those Residents with their Streak, the number of Completions in the last 7
 * and 30 local days and the 30 days' Completions grouped by day (from `FakeResident.completions`, in the Home's time zone). An
 * id that is not in the list is `404 resident not found`, like the API; 404 `no home` without a Home.
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
      const { days, count, last7 } = groupByDay(resident.completions ?? [], state.home.timezone);
      return json(200, {
        date: FAKE_TODAY,
        id: resident.id,
        you: resident.you,
        name: resident.name,
        photoUrl: resident.photoUrl,
        ...avatarFor(resident.name),
        streak: resident.streak ?? 0,
        doneLast30Days: count,
        doneLast7Days: last7,
        days,
      });
    }),
  );
}
