import type { MeState } from "../../domains/profile/hooks/useMe";

/** Whether the Finances route may show: only for the flag, and a failed read fails closed. */
export function financeAccess(me: MeState): "wait" | "render" | "redirect" {
  if (me.kind === "loading") return "wait";
  return me.kind === "ready" && me.me.finance ? "render" : "redirect";
}
