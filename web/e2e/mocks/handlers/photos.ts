import { empty, json, signedIn, type FakeApi } from "../api";
import { STORAGE_HOST } from "../photoStorage";

const MAX_BYTES = 524288;
const TYPES = ["image/webp", "image/jpeg"];

/** What the API returns as a photo's public URL; a data URL, so showing it needs no network. */
export const NEW_PHOTO_URL =
  "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='8' height='8' fill='%23e08a00'/%3E%3C/svg%3E";

/**
 * The photo routes, as `backend/internal/photos` answers them: ask (`POST /me/photo/uploads`), confirm
 * (`PUT /me/photo`) and remove (`DELETE /me/photo`). The upload goes to a fake storage host. Confirm checks that the
 * key was issued by ask, like the API's pending key, and puts the new URL on the User and on their Resident row.
 */
export function photosHandlers(api: FakeApi): void {
  let issued = 0;
  const keys = new Set<string>();

  api.on(
    "POST /me/photo/uploads",
    signedIn((request, state) => {
      const body = request.body as { contentType?: unknown; size?: unknown } | null;
      if (typeof body?.contentType !== "string" || !TYPES.includes(body.contentType)) return json(400, { error: "invalid_type" });
      if (typeof body.size !== "number" || body.size <= 0 || body.size > MAX_BYTES) return json(400, { error: "invalid_size" });
      const key = `pending/${state.user.id}/${++issued}`;
      keys.add(key);
      return json(200, {
        key,
        url: `https://${STORAGE_HOST}/${key}`,
        method: "PUT",
        headers: { "Content-Type": body.contentType },
        expiresAt: "2030-01-01T00:05:00Z",
      });
    }),
  );

  api.on(
    "PUT /me/photo",
    signedIn((request, state) => {
      const key = (request.body as { key?: unknown } | null)?.key;
      if (typeof key !== "string" || !keys.has(key)) return json(400, { error: "invalid_key" });
      state.user.photoUrl = NEW_PHOTO_URL;
      const mine = state.residents?.find((resident) => resident.you);
      if (mine) mine.photoUrl = NEW_PHOTO_URL;
      return json(200, { photoUrl: NEW_PHOTO_URL });
    }),
  );

  api.on(
    "DELETE /me/photo",
    signedIn((_, state) => {
      delete state.user.photoUrl;
      const mine = state.residents?.find((resident) => resident.you);
      if (mine) mine.photoUrl = null;
      return empty();
    }),
  );
}
