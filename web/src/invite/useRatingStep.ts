import { useCallback, useEffect, useState } from "react";
import { listChores, type Chore } from "../api/chores";
import {
  getOwnChoreSettings,
  putChorePreference,
  setChoreRestriction,
  type OwnChoreSetting,
  type OwnChoreSettings,
} from "../api/choreSettings";
import type { Preference, WriteResult } from "../api/profile";
import { selectChoresToRate } from "./ratingChores";

export type RatingState =
  | { kind: "loading" }
  | { kind: "problem" }
  | { kind: "ready"; chores: Chore[]; settings: OwnChoreSettings };

export type SaveState = { kind: "idle" } | { kind: "saved" } | { kind: "failed" };

const DEFAULT_SETTING: OwnChoreSetting = { preference: "neutral", restricted: false };

/** Loads the Home's top Chores by Effort and the Resident's own settings, and saves each change on its own. */
export function useRatingStep() {
  const [state, setState] = useState<RatingState>({ kind: "loading" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listChores(), getOwnChoreSettings()]).then(([chores, settings]) => {
      if (cancelled) return;
      if (chores.kind !== "ok" || settings.kind !== "ok") return setState({ kind: "problem" });
      setState({ kind: "ready", chores: selectChoresToRate(chores.chores), settings: settings.settings });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Shows the change at once; on failure puts back only the field it touched. */
  const change = useCallback(
    async (choreId: string, patch: Partial<OwnChoreSetting>, revert: Partial<OwnChoreSetting>, send: () => Promise<WriteResult>) => {
      const update = (p: Partial<OwnChoreSetting>) =>
        setState((s) =>
          s.kind === "ready"
            ? { ...s, settings: { ...s.settings, [choreId]: { ...(s.settings[choreId] ?? DEFAULT_SETTING), ...p } } }
            : s,
        );
      update(patch);
      setSave({ kind: "idle" });
      const result = await send();
      if (result.kind === "ok") return setSave({ kind: "saved" });
      update(revert);
      setSave({ kind: "failed" });
    },
    [],
  );

  const settingOf = (choreId: string): OwnChoreSetting =>
    (state.kind === "ready" ? state.settings[choreId] : undefined) ?? DEFAULT_SETTING;

  const setPreference = useCallback(
    (choreId: string, preference: Preference, before: Preference) => {
      if (before === preference) return;
      void change(choreId, { preference }, { preference: before }, () => putChorePreference(choreId, preference));
    },
    [change],
  );

  const setRestricted = useCallback(
    (choreId: string, restricted: boolean) => {
      void change(choreId, { restricted }, { restricted: !restricted }, () => setChoreRestriction(choreId, restricted));
    },
    [change],
  );

  return { state, save, settingOf, setPreference, setRestricted };
}
