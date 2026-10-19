import { json, shownName, signedIn, type FakeApi } from "../api";

/**
 * `GET /home/residents`: the Home's Residents with their shown names and no emails. Without `state.residents` it
 * lists only the caller, so a spec that does not care about housemates still gets a valid answer. 404 without a Home.
 */
export function residentsHandlers(api: FakeApi): void {
  api.on(
    "GET /home/residents",
    signedIn((_, state) => {
      if (state.home === null) return json(404, { error: "no home" });
      const { id, email, displayName, photoUrl } = state.user;
      const caller = { residentId: "resident-1", userId: id, name: shownName({ email, displayName }), photoUrl: photoUrl ?? null, me: true };
      return json(200, state.residents ?? [caller]);
    }),
  );
}
