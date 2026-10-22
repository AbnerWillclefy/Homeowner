import type { QueryViewState } from "../../../shared/query/view";
import type { CheckIn, Failure, Level } from "../api/api";

/** Why a save did not go through. `invalid` is the API refusing values the form should never send. */
export type SaveFailure = Failure["kind"] | "invalid" | "none";

export type CheckInState =
  | { kind: "loading" }
  | { kind: "failed"; reason: Failure["kind"] | "none" }
  | { kind: "ready"; checkIn: CheckIn };

/** The Check-in card's state from the two reads it needs. The Check-in's failure is reported before the Demand list's. */
export function checkInStateOf(
  checkIn: QueryViewState<CheckIn | null>,
  demands: QueryViewState<string[]>,
): CheckInState {
  if (checkIn.kind === "failed") return checkIn;
  if (demands.kind === "failed") return demands;
  if (checkIn.kind === "loading" || demands.kind === "loading") return { kind: "loading" };
  // Null is a 404: the caller has no Home, which this section treats as a failed load.
  return checkIn.data === null ? { kind: "failed", reason: "none" } : { kind: "ready", checkIn: checkIn.data };
}

export type CheckInView = "loading" | "failed" | "prompt" | "summary";

/**
 * What the Today row shows (the form itself is in the dialog). The prompt appears exactly when today's Check-in is missing, and nothing is kept
 * about it being skipped, so it comes back on every open.
 */
export function checkInView(state: CheckInState): CheckInView {
  if (state.kind !== "ready") return state.kind;
  if (!state.checkIn.checkedIn) return "prompt";
  return "summary";
}

/**
 * What the Energy chip on Today says, from the plan's Energy (null until there is a plan) and the Check-in:
 * - unset: no Check-in yet, so the chip invites one.
 * - drained: the Resident checked in as Drained, which gives Energy 0, so this is checked before the value.
 * - energy: points to show.
 * - no-baseline: Energy 0 without Drained, so the Resident has no Baseline for the day.
 * - pending: checked in but the plan has no Energy yet (not made, still loading or failed). Never "unset", never 0.
 */
export type EnergyNote = "unset" | "drained" | "energy" | "no-baseline" | "pending";

/** What the chip and the empty state need to know of today's Check-in. */
export type CheckInSummary = { checkedIn: boolean; level: Level | null };

export function energyNote(energy: number | null, checkIn: CheckInSummary): EnergyNote {
  if (!checkIn.checkedIn) return "unset";
  if (checkIn.level === "drained") return "drained";
  if (energy === null) return "pending";
  return energy > 0 ? "energy" : "no-baseline";
}

/** Why a planned day has no Tasks for the Resident. Shares the chip's note so the two never disagree. */
export type NoTasksReason = "drained" | "no-baseline" | "nothing-due";

export function noTasksReason(note: EnergyNote): NoTasksReason {
  return note === "drained" || note === "no-baseline" ? note : "nothing-due";
}
