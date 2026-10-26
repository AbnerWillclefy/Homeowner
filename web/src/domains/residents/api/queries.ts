import { queryOptions } from "@tanstack/react-query";
import { ApiFailure, toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getResident, getResidents, type Resident, type ResidentDetail } from "./api";

/**
 * `GET /home/residents`, under the Home's key so a join or leave clears it (ADR 0013). It is a prefix of every
 * Resident's key, so a write to this exact key leaves the pages alone.
 */
export const residentsKey = ["home", "residents"] as const;

/** One Resident's page, `GET /home/residents/{id}`: one key per Resident, so each person's page is cached on its own. */
export const residentKey = (id: string) => ["home", "residents", id] as const;

/** The Home's Residents. The queryFn throws an `ApiFailure` on a failed call. */
export const residentsQuery = queryOptions({
  queryKey: residentsKey,
  queryFn: async (): Promise<Resident[]> => {
    const result = await getResidents();
    // The list is only read while there is a Home; if the API says there is none, that is a failure to show.
    if (result.kind === "none") throw new ApiFailure("error");
    return toQueryData(result).residents;
  },
  refetchOnMount: refetchUnlessSucceeded,
});

/**
 * One Resident's page data, or null for a Resident who is not in this Home (`not-found`, or `none` when there is
 * no Home): the page shows both the same calm way. A failed call throws an `ApiFailure`.
 */
export const residentQuery = (id: string) =>
  queryOptions({
    queryKey: residentKey(id),
    queryFn: async (): Promise<ResidentDetail | null> => {
      const result = await getResident(id);
      if (result.kind === "not-found") return null;
      return toQueryData(result)?.resident ?? null;
    },
  });
