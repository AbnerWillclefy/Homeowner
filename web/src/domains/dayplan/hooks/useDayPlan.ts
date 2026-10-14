import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TaskAction } from "../logic/actions";
import {
  acceptAll as acceptAllCall,
  acceptTask,
  completeTask,
  getDayPlan,
  refuseTask,
  takeTask,
  type ActionResult,
  type DayPlan,
  type DayPlanResult,
  type Failure,
  type PlanTask,
} from "../api/api";
import { ACTION_FAILURE_KEY, conflictMessageKey, LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { latestOnly } from "../logic/latestOnly";
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

/**
 * What an action's answer does to the screen: the plan to show (absent when the one on screen is still valid)
 * and what to say. After a 409 the screen was stale, so `fresh` is the plan fetched again; without a readable
 * one the Resident is told both things.
 */
export function outcome(result: ActionResult, fresh?: DayPlanResult): { plan?: DayPlan; notice: ActionNotice | null } {
  if (result.kind === "ok") return { plan: result.plan, notice: null };
  if (result.kind !== "conflict") return { notice: { tone: "alert", keys: [ACTION_FAILURE_KEY[result.kind]] } };
  const message = conflictMessageKey(result.code);
  if (fresh?.kind === "ok") return { plan: fresh.plan, notice: { tone: "status", keys: [message] } };
  return { notice: { tone: "alert", keys: [message, LOAD_FAILURE_KEY[fresh?.kind ?? "error"]] } };
}

/**
 * Loads today's Day Plan, and again whenever `version` changes. Only mounted with a Home.
 *
 * `run` and `acceptAll` perform an action (accept, refuse, take, complete; accept everything) and show the
 * plan the server answers with. Nothing is optimistic: the plan on screen only changes from a server answer.
 * One action runs at a time for the whole section; `acting` says so, so the buttons can be disabled. After a
 * 409 the screen was stale, so the plan is reloaded in place and a message says what happened. `settled`
 * counts the actions that changed the plan, for moving focus.
 */
export function useDayPlan(version: number) {
  const [state, setState] = useState<DayPlanState>({ kind: "loading" });
  const [acting, setActing] = useState(false);
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
    setState({ kind: "loading" });
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

  const act = useCallback(async (call: () => Promise<ActionResult>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const startedAt = loads.current;
    setActing(true);
    setNotice(null);
    try {
      const result = await call();
      // The screen was stale: take the server's current plan, in place so the lists and focus stay.
      const fresh = result.kind === "conflict" ? await getDayPlan() : undefined;
      if (!mounted.current) return;
      // A load started meanwhile (`version` changed) and may have read the plan before this action: drop the
      // answer and read again in place, so the last word is a read made after the action.
      if (loads.current !== startedAt) {
        void fetchPlan();
        return;
      }
      const { plan, notice } = outcome(result, fresh);
      setNotice(notice);
      if (plan) {
        setState({ kind: "ready", plan });
        setSettled((n) => n + 1);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setActing(false);
    }
  }, [fetchPlan]);

  const run = useCallback((action: TaskAction, task: PlanTask) => void act(() => CALLS[action](task.id)), [act]);
  const acceptAll = useCallback(() => void act(acceptAllCall), [act]);

  return { state, reload, run, acceptAll, acting, notice, settled };
}
