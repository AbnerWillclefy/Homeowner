import { useCallback, useEffect, useState } from "react";
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
} from "../api/profile";
import { withBaseline, withPreference, withRestriction } from "./changes";

export type ProfileProblem = "offline" | "error" | "not-signed-in";

export type ProfileState =
  | { kind: "loading" }
  | { kind: "problem"; problem: ProfileProblem }
  | { kind: "ready"; profile: Profile; categories: string[]; demands: string[] };

export type SaveState =
  | { kind: "idle" }
  | { kind: "saved" }
  /** The change was rolled back. */
  | { kind: "failed"; problem: ProfileProblem };

/** Only mounted while signed in (see App). Writes are never queued: a failed one is undone and reported. */
export function useProfile() {
  const [state, setState] = useState<ProfileState>({ kind: "loading" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
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
   * second change made meanwhile is kept.
   */
  const change = useCallback(
    async (apply: (p: Profile) => Profile, revert: (p: Profile) => Profile, send: () => Promise<WriteResult>) => {
      const update = (fn: (p: Profile) => Profile) =>
        setState((s) => (s.kind === "ready" ? { ...s, profile: fn(s.profile) } : s));
      update(apply);
      setSave({ kind: "idle" });
      const result = await send();
      if (result.kind === "ok") return setSave({ kind: "saved" });
      update(revert);
      setSave({ kind: "failed", problem: result.kind });
    },
    [],
  );

  const readyProfile = state.kind === "ready" ? state.profile : null;

  const setBaseline = useCallback(
    (day: Weekday, points: number | null) => {
      if (!readyProfile) return;
      const before = readyProfile.baseline[day];
      if (before === points) return;
      void change(
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
        (p) => withRestriction(p, demand, restricted),
        (p) => withRestriction(p, demand, !restricted),
        () => setRestriction(demand, restricted),
      );
    },
    [change],
  );

  return { state, save, retry, setBaseline, setPreference, setRestricted };
}
