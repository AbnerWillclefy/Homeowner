import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getMe, type Me } from "./meApi";

/** `GET /me`. Under it go `["me","profile"]` and `["me","onboarding"]` (ADR 0013). */
export const meKey = ["me"] as const;

/**
 * The signed-in User. The queryFn throws an `ApiFailure` for offline, error and not-signed-in.
 *
 * `refetchOnMount` is the one named exception to "stale at once" (ADR 0013): `resolveSignedIn` fills this entry
 * with `fetchQuery`, and the Shell's `useMe` mounts right after. A cached success is not read again on mount,
 * so launch makes one `GET /me`; a failed or empty entry still is. Window focus still refreshes it.
 */
export const meQuery = queryOptions({
  queryKey: meKey,
  queryFn: async (): Promise<Me> => {
    const result = toQueryData(await getMe());
    const { kind: _kind, ...me } = result;
    return me;
  },
  refetchOnMount: refetchUnlessSucceeded,
});
