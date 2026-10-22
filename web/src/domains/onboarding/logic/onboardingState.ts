import type { QueryViewState } from "../../../shared/query/view";
import type { OnboardingPosition } from "../api/api";

export type OnboardingProblem = "offline" | "error" | "not-signed-in";

export type OnboardingState =
  | { kind: "loading" }
  | { kind: "problem"; problem: OnboardingProblem }
  /** The step the server says to show, or `done`. */
  | { kind: "ready"; position: OnboardingPosition };

/**
 * The guard's view of the onboarding query. A position that was read stays `ready` through a refetch, failed or
 * not (`viewOf` keeps the data), so the guard never goes back to "wait" or "retry" in the middle of the walk.
 */
export function onboardingStateOf(view: QueryViewState<OnboardingPosition>): OnboardingState {
  if (view.kind === "ready") return { kind: "ready", position: view.data };
  if (view.kind === "failed") return { kind: "problem", problem: view.reason };
  return { kind: "loading" };
}
