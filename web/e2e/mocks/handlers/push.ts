import { empty, json, signedIn, type FakeApi } from "../api";

/** A fixed VAPID public key, base64url: the bytes 1 to 8. The init script of a spec builds its subscription from it. */
export const FAKE_VAPID_KEY = "AQIDBAUGBwg";

/**
 * The two push routes: `GET /push/vapid-public-key` answers `FAKE_VAPID_KEY` and `PUT /push/subscription` answers
 * 204, the key is public and the save is signed in. Not part of `signedInHandlers`: a spec opts in with `fakeApi.use(pushHandlers)`.
 */
export function pushHandlers(api: FakeApi): void {
  api.on("GET /push/vapid-public-key", () => json(200, { key: FAKE_VAPID_KEY }));
  api.on("PUT /push/subscription", signedIn(() => empty(204)));
}
