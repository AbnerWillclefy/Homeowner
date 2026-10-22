import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../shared/ui/useToast";
import { updateCached } from "../../../shared/query/cacheUpdate";
import { useOptimisticView } from "../../../shared/query/useOptimisticView";
import { viewOf } from "../../../shared/query/view";
import { performChange } from "../../profile/logic/performChange";
import { choresQuery } from "../../chores/api/queries";
import type { Chore } from "../../chores/api/api";
import { putChorePreference, setChoreRestriction, type OwnChoreSetting, type OwnChoreSettings } from "../../profile/api/choreSettingsApi";
import { choreSettingsKey, choreSettingsQuery } from "../../profile/api/queries";
import type { Preference, WriteResult } from "../../profile/api/api";
import { selectChoresToRate } from "../logic/ratingChores";

export type RatingState =
  | { kind: "loading" }
  | { kind: "problem" }
  | { kind: "ready"; chores: Chore[]; settings: OwnChoreSettings };

const DEFAULT_SETTING: OwnChoreSetting = { preference: "neutral", restricted: false };

/**
 * Reads the Home's top Chores by Effort and the Resident's own settings from the query cache, and saves each
 * change on its own. The Chores are the same entry the Chores tab reads. The settings writes answer 204, so a
 * change stays in the cache when saved and only the field it touched is put back when not.
 */
export function useRatingStep() {
  const queryClient = useQueryClient();
  const chores = viewOf(useQuery(choresQuery)).state;
  const settings = useOptimisticView(choreSettingsQuery).state;
  const toast = useToast();
  const inFlight = useRef(new Set<string>());

  const state: RatingState =
    chores.kind === "failed" || settings.kind === "failed"
      ? { kind: "problem" }
      : chores.kind === "ready" && settings.kind === "ready"
        ? { kind: "ready", chores: selectChoresToRate(chores.data), settings: settings.data }
        : { kind: "loading" };

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
        updateCached(queryClient, choreSettingsKey, (all: OwnChoreSettings) => ({
          ...all,
          [choreId]: { ...(all[choreId] ?? DEFAULT_SETTING), ...p },
        }));
      return performChange(inFlight.current, {
        key,
        apply: () => update(patch),
        revert: () => update(revert),
        send,
        onSaved: () => toast.show({ messageKey: "invite.rating.saved", tone: "success" }),
        onFailed: () => toast.show({ messageKey: "invite.rating.saveFailed", tone: "error" }),
      });
    },
    [toast, queryClient],
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
