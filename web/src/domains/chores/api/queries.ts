import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { listChores, type Chore } from "./api";

/**
 * `GET /home/chores`, under the Home's key so a join or leave clears it (ADR 0013). It is a prefix of any key
 * under it (the Chore settings), so a write to this exact key leaves those alone.
 */
export const choresKey = ["home", "chores"] as const;

/** The Home's Chores. The queryFn throws an `ApiFailure` on a failed call. */
export const choresQuery = queryOptions({
  queryKey: choresKey,
  queryFn: async (): Promise<Chore[]> => toQueryData(await listChores()).chores,
});
