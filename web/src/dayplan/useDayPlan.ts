import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDayPlan, type DayPlan, type DayPlanResult, type Failure } from "./api";
import { ACTION_FAILURE_KEY, conflictMessageKey, LOAD_FAILURE_KEY } from "./failureMessages";
import { latestOnly } from "./latestOnly";
import type { MessageKey } from "../shared/i18n";

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

/** Why a plan could not be read. Only actions answer 409, so a conflict on a load reads as an error. */
function failedReason(result: Exclude<DayPlanResult, { kind: "ok" }>): FailedReason {
  return result.kind === "conflict" ? "error" : result.kind;
}

/**
 * Loads today's Day Plan, and again whenever `version` changes. Only mounted with a Home.
 *
 * `act` runs one action (accept, refuse, take, complete) and shows the plan the server answers with. Nothing is
 * optimistic: the plan on screen only changes from a server answer. One action runs at a time for the whole
 * section; `acting` says so, so the buttons can be disabled. After a 409 the screen was stale, so the plan is
 * reloaded in place and a message says what happened. `settled` counts finished actions, for moving focus.
 */
export function useDayPlan(version: number) {
  const [state, setState] = useState<DayPlanState>({ kind: "loading" });
  const [acting, setActing] = useState(false);
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [settled, setSettled] = useState(0);
  const inFlight = useRef(false);
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
        setState(result.kind === "ok" ? { kind: "ready", plan: result.plan } : { kind: "failed", reason: failedReason(result) }),
      ),
    [],
  );

  const load = useCallback(() => {
    setState({ kind: "loading" });
    return fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    void load();
  }, [load, version]);

  /** Retry: ignored while an action runs, so a late load can never overwrite the action's plan. */
  const reload = useCallback(() => {
    if (inFlight.current) return Promise.resolve();
    return load();
  }, [load]);

  const act = useCallback(async (call: () => Promise<DayPlanResult>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setActing(true);
    setNotice(null);
    try {
      const result = await call();
      if (!mounted.current) return;
      if (result.kind === "ok") {
        setState({ kind: "ready", plan: result.plan });
      } else if (result.kind === "conflict") {
        const message = conflictMessageKey(result.code);
        // The screen was stale: take the server's current plan, in place so the lists and focus stay.
        const fresh = await getDayPlan();
        if (!mounted.current) return;
        if (fresh.kind === "ok") {
          setState({ kind: "ready", plan: fresh.plan });
          setNotice({ tone: "status", keys: [message] });
        } else {
          setNotice({ tone: "alert", keys: [message, LOAD_FAILURE_KEY[failedReason(fresh)]] });
        }
      } else {
        // The plan on screen is still valid, so it stays.
        setNotice({ tone: "alert", keys: [ACTION_FAILURE_KEY[result.kind]] });
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setActing(false);
        setSettled((n) => n + 1);
      }
    }
  }, []);

  return { state, reload, act, acting, notice, settled };
}
