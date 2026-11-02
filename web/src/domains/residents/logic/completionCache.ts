import type { QueryClient } from "@tanstack/react-query";
import { invalidateDayPlan, invalidateStreak } from "../../dayplan/logic/planCache";
import type { ResidentDetail } from "../api/api";
import { residentKey, residentsKey } from "../api/queries";

/**
 * Puts the detail the server answered to a moved Completion into the cache, then marks stale what it changed: the
 * Day Plan (Today's Done list), the Streak and the Residents. A read of the detail still running is cancelled
 * first, so its older answer cannot bring the old day back. `residentsKey` is a prefix of every detail, so it also
 * marks a partner's page stale (right for a two-person Completion); the caller's own detail is left out, because
 * it was just written and a read behind it would only flash the screen.
 */
export async function writeMovedCompletion(client: QueryClient, detail: ResidentDetail): Promise<void> {
  await client.cancelQueries({ queryKey: residentKey(detail.id) });
  client.setQueryData(residentKey(detail.id), detail);
  void invalidateDayPlan(client);
  void invalidateStreak(client);
  void client.invalidateQueries({ queryKey: residentsKey, predicate: (query) => query.queryKey[2] !== detail.id });
}
