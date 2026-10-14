import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../shared/ui/useToast";
import { performChange } from "../../profile/logic/performChange";
import { listChores, type Chore } from "../../chores/api/api";
import {
  getOwnChoreSettings,
  putChorePreference,
  setChoreRestriction,
  type OwnChoreSetting,
  type OwnChoreSettings,
} from "../../profile/api/choreSettingsApi";
import type { Preference, WriteResult } from "../../profile/api/api";
import { selectChoresToRate } from "../logic/ratingChores";

export type RatingState =
  | { kind: "loading" }
  | { kind: "problem" }
  | { kind: "ready"; chores: Chore[]; settings: OwnChoreSettings };

const DEFAULT_SETTING: OwnChoreSetting = { preference: "neutral", restricted: false };

/** Loads the Home's top Chores by Effort and the Resident's own settings, and saves each change on its own. */
export function useRatingStep() {
  const [state, setState] = useState<RatingState>({ kind: "loading" });
  const toast = useToast();
  const inFlight = useRef(new Set<string>());

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

  /**
   * Shows the change at once; on failure puts back only the field it touched. Guarded per control (`key`), so
   * rapid taps on one control send one request while another control is not held up. A saved change is a toast;
   * a failed one is undone, so an error toast is all it needs.
   */
  const change = useCallback(
    (
      key: string,
      choreId: string,
      patch: Partial<OwnChoreSetting>,
      revert: Partial<OwnChoreSetting>,
      send: () => Promise<WriteResult>,
    ) => {
      const update = (p: Partial<OwnChoreSetting>) =>
        setState((s) =>
          s.kind === "ready"
            ? { ...s, settings: { ...s.settings, [choreId]: { ...(s.settings[choreId] ?? DEFAULT_SETTING), ...p } } }
            : s,
        );
      return performChange(inFlight.current, {
        key,
        apply: () => update(patch),
        revert: () => update(revert),
        send,
        onSaved: () => toast.show({ messageKey: "invite.rating.saved", tone: "success" }),
        onFailed: () => toast.show({ messageKey: "invite.rating.saveFailed", tone: "error" }),
      });
    },
    [toast],
  );

  const settingOf = (choreId: string): OwnChoreSetting =>
    (state.kind === "ready" ? state.settings[choreId] : undefined) ?? DEFAULT_SETTING;

  const setPreference = useCallback(
    (choreId: string, preference: Preference, before: Preference) => {
      if (before === preference) return;
      void change(`preference:${choreId}`, choreId, { preference }, { preference: before }, () =>
        putChorePreference(choreId, preference),
      );
    },
    [change],
  );

  const setRestricted = useCallback(
    (choreId: string, restricted: boolean) => {
      void change(`restricted:${choreId}`, choreId, { restricted }, { restricted: !restricted }, () =>
        setChoreRestriction(choreId, restricted),
      );
    },
    [change],
  );

  return { state, settingOf, setPreference, setRestricted };
}
