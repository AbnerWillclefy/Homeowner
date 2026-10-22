import { queryOptions } from "@tanstack/react-query";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { lookupInvite } from "./api";

/**
 * `GET /invites/{token}`: whether an Invite can be used. It runs signed out, and it is not under the Home's key,
 * so neither a join or leave nor the signed-in to signed-out clear (ADR 0013) takes it away.
 */
export const inviteKey = (token: string) => ["invites", token] as const;

/**
 * What the lookup found: `valid`, or a dead Invite (`not-found`, `used`, `expired`), all of which are data. Only
 * `offline` and `error` throw an `ApiFailure`.
 */
export const inviteQuery = (token: string) =>
  queryOptions({
    queryKey: inviteKey(token),
    queryFn: async () => {
      const result = await lookupInvite(token);
      if (result.kind === "offline" || result.kind === "error") throw new ApiFailure(result.kind);
      return result;
    },
  });
