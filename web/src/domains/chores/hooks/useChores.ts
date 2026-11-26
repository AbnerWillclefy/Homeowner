import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteChore, type Chore } from "../api/api";
import { choresQuery } from "../api/queries";
import { categoriesQuery, demandsQuery } from "../../profile/api/queries";
import { removeChoreFromCache, saveChoreInCache } from "../logic/choreCache";
import { removeChore } from "../logic/choreList";
import { DELETE_FAILURE_KEY } from "../logic/failureMessages";
import { choresStateOf, type ChoresState } from "../logic/choresState";
import { viewOf } from "../../../shared/query/view";
import type { SendResult } from "../../../shared/undo/pendingWrite";
import { useUndoable, useUndoOverlay } from "../../../shared/undo/useUndoable";

/** The overlay scope of the Chores list: its held and sending deletes (ADR 0029). */
const SCOPE = "chores";

export type { ChoresState };

/**
 * The Home's Chores with the Category and Demand lists the form needs, from three queries in the cache. Only
 * mounted with a Home. Cached lists show at once and a refetch runs behind them (`refreshing`); only a first
 * load or a Retry shows the loading state, and a failed refetch keeps the lists on screen with no alert.
 *
 * `upsert` writes what the server answered into the Chores cache, so a create or edit sends no new read of the
 * list. `destroy` is an undoable delete (ADR 0029): the Chore leaves `state` at once, the request is held until
 * the Desfazer Toast closes, and only the server's answer reaches the cache.
 */
export function useChores() {
  const queryClient = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const demands = useQuery(demandsQuery);
  const chores = useQuery(choresQuery);
  const views = [viewOf(categories), viewOf(demands), viewOf(chores)] as const;
  const cached = choresStateOf(views[0].state, views[1].state, views[2].state);
  // The cached list with the held and sending deletes applied: what the screen shows.
  const shown = useUndoOverlay<Chore[]>(SCOPE, cached.kind === "ready" ? cached.chores : []);
  const state: ChoresState = cached.kind === "ready" ? { ...cached, chores: shown } : cached;
  const { undoable } = useUndoable();
  const refreshing = state.kind === "ready" && views.some((v) => v.refreshing);
  const { refetch: refetchCategories } = categories;
  const { refetch: refetchDemands } = demands;
  const { refetch: refetchChores } = chores;

  /** Retry: reads all three again. */
  const reload = useCallback(async () => {
    await Promise.all([refetchCategories(), refetchDemands(), refetchChores()]);
  }, [refetchCategories, refetchDemands, refetchChores]);

  /** Adds a new Chore, or replaces the one with the same id. */
  const upsert = useCallback((chore: Chore) => void saveChoreInCache(queryClient, chore), [queryClient]);

  /** Deletes a Chore with Desfazer: held, then sent when the Toast closes. A Chore already gone counts as deleted. */
  const destroy = useCallback(
    (chore: Chore) =>
      undoable({
        scope: SCOPE,
        titleKey: "chores.undo.delete",
        titleParams: { name: chore.name },
        apply: (data) => removeChore(data as Chore[], chore.id),
        failedKey: DELETE_FAILURE_KEY.error,
        send: async ({ keepalive }): Promise<SendResult> => {
          const result = await deleteChore(chore.id, { keepalive });
          if (result.kind !== "ok" && result.kind !== "none") return { kind: "failed", messageKey: DELETE_FAILURE_KEY[result.kind] };
          await removeChoreFromCache(queryClient, chore.id);
          return { kind: "ok" };
        },
      }),
    [undoable, queryClient],
  );

  return { state, refreshing, reload, upsert, destroy };
}
