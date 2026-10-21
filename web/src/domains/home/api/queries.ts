import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { getHome, type Home } from "./api";

/** `GET /home`. Home-scoped children go under it, so one partial key reaches them all (ADR 0013). */
export const homeKey = ["home"] as const;

/** The caller's Home, or null when they have none. The queryFn throws an `ApiFailure` on a failed call. */
export const homeQuery = queryOptions({
  queryKey: homeKey,
  queryFn: async (): Promise<Home | null> => toQueryData(await getHome())?.home ?? null,
});
