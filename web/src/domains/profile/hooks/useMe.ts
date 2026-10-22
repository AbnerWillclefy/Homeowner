import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "../../auth/api/queries";
import type { Me } from "../../auth/api/meApi";
import { viewOf, type QueryViewState } from "../../../shared/query/view";

export type MeState =
  | { kind: "loading" }
  | { kind: "ready"; me: Me }
  /** The call failed (offline, server error). Callers fall back to what they showed before the name existed. */
  | { kind: "failed" };

function meStateOf(state: QueryViewState<Me>): MeState {
  switch (state.kind) {
    case "loading":
      return state;
    case "failed":
      return { kind: "failed" };
    case "ready":
      return { kind: "ready", me: state.data };
  }
}

/**
 * The signed-in User as `GET /me` last said, with the shown name and photo, read from the query cache that
 * `resolveSignedIn` already filled. Mounted in the Shell and shared through ShellContext: Today's greeting and
 * the Me header read it. It does not depend on a Home, so Me works without one.
 *
 * A saved name or photo is written by `saveMe` and `savePhoto` (api/cacheWrites), which also refresh the
 * Residents. `reload` asks again, after a failure; it shows `loading` meanwhile. A failed refresh keeps the User
 * on screen, and `refreshing` is true while a read runs over a User already shown.
 */
export function useMe() {
  const query = useQuery(meQuery);
  const { state, refreshing } = viewOf(query);
  const { refetch } = query;

  const reload = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { state: meStateOf(state), refreshing, reload };
}
