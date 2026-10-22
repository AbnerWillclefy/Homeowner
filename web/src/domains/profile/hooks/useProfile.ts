import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  putBaseline,
  putPreference,
  setRestriction,
  type Preference,
  type Profile,
  type Weekday,
  type WriteResult,
} from "../api/api";
import { categoriesQuery, demandsQuery, profileKey, profileQuery } from "../api/queries";
import { useToast } from "../../../shared/ui/useToast";
import type { MessageKey } from "../../../shared/i18n";
import { updateCached } from "../../../shared/query/cacheUpdate";
import { useOptimisticView } from "../../../shared/query/useOptimisticView";
import { viewOf } from "../../../shared/query/view";
import { withBaseline, withPreference, withRestriction } from "../logic/changes";
import { performChange } from "../logic/performChange";

export type ProfileProblem = "offline" | "error" | "not-signed-in";

const SAVE_FAILED_KEY: Record<ProfileProblem, MessageKey> = {
  offline: "profile.saveFailed",
  error: "profile.saveFailed",
  "not-signed-in": "profile.saveFailed.notSignedIn",
};

export type ProfileState =
  | { kind: "loading" }
  | { kind: "problem"; problem: ProfileProblem }
  | { kind: "ready"; profile: Profile; categories: string[]; demands: string[] };

/**
 * Only mounted while signed in (see App). The profile and the two lists are read from the query cache, so a
 * profile seen before shows at once and a read runs behind it (`refreshing`); only a first load or a Retry is
 * `loading`. Writes are never queued: a saved one shows a toast, a failed one is undone and reported in an error
 * toast (the value is back as it was, so there is nothing to act on).
 */
export function useProfile() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const categoriesRead = useQuery(categoriesQuery);
  const demandsRead = useQuery(demandsQuery);
  const inFlight = useRef(new Set<string>());

  // The lists and the profile are independent reads; the first failure decides the problem shown.
  const categoriesView = viewOf(categoriesRead);
  const demandsView = viewOf(demandsRead);
  const profileView = useOptimisticView(profileQuery);
  const profileRead = profileView.read;
  const { state: categories } = categoriesView;
  const { state: demands } = demandsView;
  const { state: profile } = profileView;
  const [failed] = [categories, demands, profile].flatMap((s) => (s.kind === "failed" ? [s] : []));

  const state: ProfileState =
    failed
      ? { kind: "problem", problem: failed.reason }
      : categories.kind === "ready" && demands.kind === "ready" && profile.kind === "ready"
        ? { kind: "ready", profile: profile.data, categories: categories.data, demands: demands.data }
        : { kind: "loading" };
  /** A read runs over a profile that is already on screen: the Me header shows the quiet indicator. */
  const refreshing = state.kind === "ready" && [categoriesView, demandsView, profileView].some((v) => v.refreshing);

  const retry = useCallback(() => {
    for (const read of [categoriesRead, demandsRead, profileRead]) if (read.isError) void read.refetch();
  }, [categoriesRead, demandsRead, profileRead]);

  /**
   * Shows the change at once, sends it, and on failure puts back only the field it touched, so a
   * second change made meanwhile is kept. Guarded per control `key`: a repeat on the same control while its
   * request is in flight is ignored; other controls are not held up. The writes answer 204 with no body, so
   * there is no server answer to store: the change stays in the cache when saved and is reverted when not.
   */
  const change = useCallback(
    (
      key: string,
      apply: (p: Profile) => Profile,
      revert: (p: Profile) => Profile,
      send: () => Promise<WriteResult>,
    ) =>
      performChange(inFlight.current, {
        key,
        apply: () => updateCached(queryClient, profileKey, apply),
        revert: () => updateCached(queryClient, profileKey, revert),
        send,
        onSaved: () => toast.show({ messageKey: "profile.saved", tone: "success" }),
        onFailed: (problem) => toast.show({ messageKey: SAVE_FAILED_KEY[problem], tone: "error" }),
      }),
    [toast, queryClient],
  );

  const readyProfile = state.kind === "ready" ? state.profile : null;

  const setBaseline = useCallback(
    (day: Weekday, points: number | null) => {
      if (!readyProfile) return;
      const before = readyProfile.baseline[day];
      if (before === points) return;
      void change(
        `baseline:${day}`,
        (p) => withBaseline(p, day, points),
        (p) => withBaseline(p, day, before),
        () => putBaseline({ [day]: points }),
      );
    },
    [readyProfile, change],
  );

  const setPreference = useCallback(
    (category: string, preference: Preference) => {
      if (!readyProfile) return;
      const before = readyProfile.preferences[category] ?? "neutral";
      if (before === preference) return;
      void change(
        `preference:${category}`,
        (p) => withPreference(p, category, preference),
        (p) => withPreference(p, category, before),
        () => putPreference(category, preference),
      );
    },
    [readyProfile, change],
  );

  const setRestricted = useCallback(
    (demand: string, restricted: boolean) => {
      void change(
        `restriction:${demand}`,
        (p) => withRestriction(p, demand, restricted),
        (p) => withRestriction(p, demand, !restricted),
        () => setRestriction(demand, restricted),
      );
    },
    [change],
  );

  return { state, refreshing, retry, setBaseline, setPreference, setRestricted };
}
