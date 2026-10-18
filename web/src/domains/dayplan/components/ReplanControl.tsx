import { config } from "../../../shared/config";
import type { DayPlan } from "../api/api";
import { useReplan } from "../hooks/useReplan";
import { runIdOf } from "../logic/replan";
import { ReplanButton } from "./ReplanButton";

/**
 * Wires "Replan now" to the Day Plan on screen. The flag is checked before the hook mounts, so a production
 * build (flag off) runs no replan code and starts no timers.
 */
export function ReplanControl({ plan, show }: { plan: DayPlan | undefined; show(plan: DayPlan): void }) {
  if (!config.replanEnabled) return null;
  return <ActiveReplan plan={plan} show={show} />;
}

function ActiveReplan({ plan, show }: { plan: DayPlan | undefined; show(plan: DayPlan): void }) {
  const { state, press } = useReplan(runIdOf(plan), show);
  return <ReplanButton state={state} onPress={press} />;
}
