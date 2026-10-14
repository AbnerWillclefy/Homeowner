import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCategories,
  getDemands,
  getProfile,
  putBaseline,
  putPreference,
  setRestriction,
  type Preference,
  type Profile,
  type Weekday,
  type WriteResult,
} from "../api/api";
import { useToast } from "../../../shared/ui/useToast";
import type { MessageKey } from "../../../shared/i18n";
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
 * Only mounted while signed in (see App). Writes are never queued: a saved one shows a toast, a failed one is
 * undone and reported in an error toast (the value is back as it was, so there is nothing to act on).
 */
export function useProfile() {
  const toast = useToast();
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const inFlight = useRef(new Set<string>());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    // The lists and the profile are independent reads; the first failure decides the problem shown.
    Promise.all([getCategories(), getDemands(), getProfile()]).then(([categories, demands, profile]) => {
      if (cancelled) return;
      for (const result of [categories, demands, profile]) {
        if (result.kind !== "ok") return setState({ kind: "problem", problem: result.kind });
      }
      if (categories.kind === "ok" && demands.kind === "ok" && profile.kind === "ok") {
        setState({ kind: "ready", profile: profile.profile, categories: categories.ids, demands: demands.ids });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  /**
   * Shows the change at once, sends it, and on failure puts back only the field it touched, so a
   * second change made meanwhile is kept. Guarded per control `key`: a repeat on the same control while its
   * request is in flight is ignored; other controls are not held up.
   */
  const change = useCallback(
    (
      key: string,
      apply: (p: Profile) => Profile,
      revert: (p: Profile) => Profile,
      send: () => Promise<WriteResult>,
    ) => {
      const update = (fn: (p: Profile) => Profile) =>
        setState((s) => (s.kind === "ready" ? { ...s, profile: fn(s.profile) } : s));
      return performChange(inFlight.current, {
        key,
        apply: () => update(apply),
        revert: () => update(revert),
        send,
        onSaved: () => toast.show({ messageKey: "profile.saved", tone: "success" }),
        onFailed: (problem) => toast.show({ messageKey: SAVE_FAILED_KEY[problem], tone: "error" }),
      });
    },
    [toast],
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

  return { state, retry, setBaseline, setPreference, setRestricted };
}
