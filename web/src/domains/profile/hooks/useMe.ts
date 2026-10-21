import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { meKey, meQuery } from "../../auth/api/queries";
import type { Me } from "../../auth/api/meApi";
import { viewOf } from "../../../shared/query/view";

export type MeState =
  | { kind: "loading" }
  | { kind: "ready"; me: Me }
  /** The call failed (offline, server error). Callers fall back to what they showed before the name existed. */
  | { kind: "failed" };

/**
 * The signed-in User as `GET /me` last said, with the shown name and photo, read from the query cache that
 * `resolveSignedIn` already filled. Mounted in the Shell and shared through ShellContext: Today's greeting and
 * the Me header read it. It does not depend on a Home, so Me works without one.
 *
 * `update` changes the current User from its newest value (for a change that lands after a slow call). `set` puts in a User the API just answered (after a name is saved), so every screen shows it at once without
 * another request. `reload` asks again, after a failure; it shows `loading` meanwhile. A failed refresh keeps the
 * User on screen.
 */
export function useMe() {
  const queryClient = useQueryClient();
  const query = useQuery(meQuery);
  const { state } = viewOf(query);
  const { refetch } = query;

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  const set = useCallback((me: Me) => queryClient.setQueryData(meKey, me), [queryClient]);

  /** Changes the User from the newest cached value, so a slow call never overwrites a `set` that landed meanwhile. */
  const update = useCallback(
    (change: (current: Me) => Me) => {
      queryClient.setQueryData<Me>(meKey, (current) => (current === undefined ? current : change(current)));
    },
    [queryClient],
  );

  const meState: MeState =
    state.kind === "ready" ? { kind: "ready", me: state.data } : state.kind === "failed" ? { kind: "failed" } : { kind: "loading" };
  return { state: meState, set, update, reload };
}
