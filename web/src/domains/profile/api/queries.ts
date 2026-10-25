import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getCategories, getDemands, getProfile, type Profile } from "./api";
import { getOwnChoreSettings, type OwnChoreSettings } from "./choreSettingsApi";

/** `GET /categories`. The list is the same for every Home, so the key sits outside `["home"]`. */
export const categoriesKey = ["categories"] as const;
/** `GET /demands`. The list is the same for every Home, so the key sits outside `["home"]`. */
export const demandsKey = ["demands"] as const;

/** The Category ids. The queryFn throws an `ApiFailure` on a failed call. */
export const categoriesQuery = queryOptions({
  queryKey: categoriesKey,
  queryFn: async (): Promise<string[]> => toQueryData(await getCategories()).ids,
});

/** `GET /me/profile`, under `me` (ADR 0013). A write to `["me"]` leaves it alone; sign-out clears it with the rest. */
export const profileKey = ["me", "profile"] as const;

/** The signed-in User's Baseline, Preferences and Restrictions. The queryFn throws an `ApiFailure` on a failed call. */
export const profileQuery = queryOptions({
  queryKey: profileKey,
  queryFn: async (): Promise<Profile> => toQueryData(await getProfile()).profile,
});

/**
 * `GET /home/chores/settings`, the caller's own row. It sits under the Home's key, so a join or leave clears it
 * (`forgetHomeScope`), and under the Chores key, which is why a write to `choresKey` must stay `exact`.
 */
export const choreSettingsKey = ["home", "chores", "settings"] as const;

/** The Resident's own setting for each Chore of their Home. The queryFn throws an `ApiFailure` on a failed call. */
export const choreSettingsQuery = queryOptions({
  queryKey: choreSettingsKey,
  queryFn: async (): Promise<OwnChoreSettings> => toQueryData(await getOwnChoreSettings()).settings,
});

/** The Demand ids the Check-in form and the Chores forms offer; both read this one entry. */
export const demandsQuery = queryOptions({
  queryKey: demandsKey,
  queryFn: async (): Promise<string[]> => toQueryData(await getDemands()).ids,
  refetchOnMount: refetchUnlessSucceeded,
});
