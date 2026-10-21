import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { getCategories, getDemands } from "./api";

/** `GET /categories`. The list is the same for every Home, so the key sits outside `["home"]`. */
export const categoriesKey = ["categories"] as const;
/** `GET /demands`. The list is the same for every Home, so the key sits outside `["home"]`. */
export const demandsKey = ["demands"] as const;

/** The Category ids. The queryFn throws an `ApiFailure` on a failed call. */
export const categoriesQuery = queryOptions({
  queryKey: categoriesKey,
  queryFn: async (): Promise<string[]> => toQueryData(await getCategories()).ids,
});

/** The Demand ids the Check-in form and the Chores forms offer; both read this one entry. */
export const demandsQuery = queryOptions({
  queryKey: demandsKey,
  queryFn: async (): Promise<string[]> => toQueryData(await getDemands()).ids,
});
