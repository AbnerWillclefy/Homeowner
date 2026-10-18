import { json, signedIn, type FakeApi } from "../api";

/** What the Chores tab reads: the Home's stored Chores. Needs a Home, like the API (404 without one). */
export function choresHandlers(api: FakeApi): void {
  api.on("GET /home/chores", signedIn((_, state) => (state.home === null ? json(404, { error: "no home" }) : json(200, { chores: state.chores }))));
}
