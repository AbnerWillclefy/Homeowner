import type { QueryClient } from "@tanstack/react-query";
import { meKey } from "../../auth/api/queries";
import type { Me } from "../../auth/api/meApi";
import { residentsKey } from "../../residents/api/queries";

/**
 * The name and the photo are shown to housemates, so one answer goes to two caches: the User into `me`, and the
 * Residents marked stale. `residentsKey` without `exact` also covers every Resident's page, so a page that shows
 * your name refreshes too. A read of `me` that started earlier is cancelled first, so its older answer cannot
 * bring the old User back.
 */
async function writeMe(client: QueryClient, change: (current: Me | undefined) => Me | undefined): Promise<void> {
  await client.cancelQueries({ queryKey: meKey, exact: true });
  client.setQueryData<Me>(meKey, change);
  void client.invalidateQueries({ queryKey: residentsKey });
}

/** A saved name: the User the API answered goes in, so every screen shows it with no other request. */
export function saveMe(client: QueryClient, me: Me): Promise<void> {
  return writeMe(client, () => me);
}

/** A new or removed photo, set on the newest User so a slow call never overwrites a name saved meanwhile. */
export function savePhoto(client: QueryClient, photoUrl: string | null): Promise<void> {
  return writeMe(client, (current) => (current === undefined ? current : { ...current, photoUrl }));
}
