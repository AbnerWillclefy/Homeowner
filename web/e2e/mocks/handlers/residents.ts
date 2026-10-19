import { avatarFor, json, shownName, signedIn, type FakeApi, type FakeResident } from "../api";
import { FAKE_TODAY } from "./today";

/**
 * `GET /home/residents`: `{date, residents}` with the Home's Residents, their shown names, avatar fallback, Streak
 * and done-today count, and no emails or user ids. Without `state.residents` it lists only the caller, so a spec
 * that does not care about housemates still gets a valid answer. 404 without a Home.
 */
export function residentsHandlers(api: FakeApi): void {
  api.on(
    "GET /home/residents",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const { email, displayName, photoUrl } = state.user;
      const caller: FakeResident = { id: "resident-1", you: true, name: shownName({ email, displayName }), photoUrl: photoUrl ?? null };
      const residents = (state.residents ?? [caller]).map(({ streak, doneToday, ...resident }) => ({
        ...resident,
        ...avatarFor(resident.name),
        streak: streak ?? 0,
        doneToday: doneToday ?? 0,
      }));
      return json(200, { date: FAKE_TODAY, residents });
    }),
  );
}
