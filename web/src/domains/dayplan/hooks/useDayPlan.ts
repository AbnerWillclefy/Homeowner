import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isSwapAction, type Acting, type SwapAction, type TaskAction } from "../logic/actions";
import {
  acceptAll as acceptAllCall,
  acceptSwap,
  acceptTask,
  cancelSwap,
  completeTask,
  declineSwap,
  getDayPlan,
  offerSwap,
  refuseTask,
  takeTask,
  type ActionResult,
  type DayPlan,
  type DayPlanResult,
  type Failure,
  type PlanTask,
} from "../api/api";
import { ACTION_FAILURE_KEY, conflictMessageKey, LOAD_FAILURE_KEY, type ConflictFamily } from "../logic/failureMessages";
import { latestOnly } from "../logic/latestOnly";
import { whenLoadStarts } from "../logic/loadState";
import type { MessageKey } from "../../../shared/i18n";

type FailedReason = Failure["kind"] | "none";

export type DayPlanState =
  | { kind: "loading" }
  | { kind: "failed"; reason: FailedReason }
  | { kind: "ready"; plan: DayPlan };

/** What the last action said: a status for a stale screen, an alert when something failed. */
export interface ActionNotice {
  tone: "status" | "alert";
  keys: MessageKey[];
}

/** Calls the API for an action on a Task. */
const CALLS: Record<TaskAction, (id: string) => Promise<ActionResult>> = {
  accept: acceptTask,
  refuse: refuseTask,
  take: takeTask,
  done: completeTask,
};

/** The API call for the action in flight: the one source of what runs, so it cannot drift from what is shown. */
function callFor(running: NonNullable<Acting>): Promise<ActionResult> {
  switch (running.action) {
    case "acceptAll":
      return acceptAllCall();
    case "offerSwap":
      return offerSwap(running.offeredTaskId, running.requestedTaskId);
    case "acceptSwap":
      return acceptSwap(running.swapId);
    case "declineSwap":
      return declineSwap(running.swapId);
    case "cancelSwap":
      return cancelSwap(running.swapId);
    default:
      return CALLS[running.action](running.taskId);
  }
}

/** Which wording an action's conflicts use: the Swap table for the four Swap actions, the Task one otherwise. */
const familyFor = (running: NonNullable<Acting>): ConflictFamily =>
  isSwapAction(running.action) ? "swap" : "task";

/**
 * What an action's answer does to the screen: the plan to show (absent when the one on screen is still valid)
 * and what to say. After a 409 the screen was stale, so `fresh` is the plan fetched again; without a readable
 * one the Resident is told both things.
 */
export function outcome(
  result: ActionResult,
  fresh?: DayPlanResult,
  family: ConflictFamily = "task",
): { plan?: DayPlan; notice: ActionNotice | null } {
  if (result.kind === "ok") return { plan: result.plan, notice: null };
  if (result.kind !== "conflict") return { notice: { tone: "alert", keys: [ACTION_FAILURE_KEY[result.kind]] } };
  const message = conflictMessageKey(result.code, family);
  if (fresh?.kind === "ok") return { plan: fresh.plan, notice: { tone: "status", keys: [message] } };
  return { notice: { tone: "alert", keys: [message, LOAD_FAILURE_KEY[fresh?.kind ?? "error"]] } };
}

/**
 * Loads today's Day Plan, and again whenever `version` changes. Only mounted with a Home. Only a first load or a
 * Retry shows the loading state; a reload while a plan is on screen keeps it there until the answer replaces it.
 *
 * `run` and `acceptAll` perform an action (accept, refuse, take, complete; accept everything) and show the
 * plan the server answers with. Nothing is optimistic: the plan on screen only changes from a server answer.
 * One action runs at a time for the whole section; `acting` says which (the Task and the action, or Accept
 * all), so every button is disabled and only the pressed one shows its spinner. After a
 * 409 the screen was stale, so the plan is reloaded in place and a message says what happened. `settled`
 * counts the actions that changed the plan, for moving focus.
 */
export function useDayPlan(version: number) {
  const [state, setState] = useState<DayPlanState>({ kind: "loading" });
  const [acting, setActing] = useState<Acting>(null);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [settled, setSettled] = useState(0);
  const inFlight = useRef(false);
  const loads = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchPlan = useMemo(
    () =>
      latestOnly(getDayPlan, (result) =>
        setState(result.kind === "ok" ? { kind: "ready", plan: result.plan } : { kind: "failed", reason: result.kind }),
      ),
    [],
  );

  const load = useCallback(() => {
    loads.current++;
    setState(whenLoadStarts);
    return fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    void load();
  }, [load, version]);

  /** Retry: ignored while an action runs. A load that starts anyway (`version` changed) is handled by `act`. */
  const reload = useCallback(() => {
    if (inFlight.current) return Promise.resolve();
    return load();
  }, [load]);

  const act = useCallback(async (running: NonNullable<Acting>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const family = familyFor(running);
    const startedAt = loads.current;
    setActing(running);
    setNotice(null);
    try {
      const result = await callFor(running);
      // The screen was stale: take the server's current plan, in place so the lists and focus stay.
      const fresh = result.kind === "conflict" ? await getDayPlan() : undefined;
      if (!mounted.current) return;
      // A load started meanwhile (`version` changed) and may have read the plan before this action: drop the
      // answer and read again in place, so the last word is a read made after the action.
      if (loads.current !== startedAt) {
        void fetchPlan();
        return;
      }
      const { plan, notice } = outcome(result, fresh, family);
      setNotice(notice);
      if (plan) {
        setState({ kind: "ready", plan });
        setSettled((n) => n + 1);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setActing(null);
    }
  }, [fetchPlan]);

  const run = useCallback(
    (action: TaskAction, task: PlanTask) => void act({ taskId: task.id, action }),
    [act],
  );
  const acceptAll = useCallback(() => void act({ taskId: null, action: "acceptAll" }), [act]);

  /** Offers a Swap. Resolves when the action ends, so the offer dialog can wait for it. */
  const offer = useCallback(
    (offeredTaskId: string, requestedTaskId: string) => act({ action: "offerSwap", offeredTaskId, requestedTaskId }),
    [act],
  );
  /** Accepts, declines or cancels a Swap offer. Resolves when the action ends. */
  const answerSwap = useCallback((action: SwapAction, swapId: string) => act({ action, swapId }), [act]);

  /** Shows a plan that was read elsewhere, without the loading state: the lists update in place. */
  const show = useCallback((plan: DayPlan) => {
    if (mounted.current) setState({ kind: "ready", plan });
  }, []);

  return { state, reload, run, acceptAll, offerSwap: offer, answerSwap, acting, notice, settled, show };
}
