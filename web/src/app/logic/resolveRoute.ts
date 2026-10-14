import type { OnboardingPosition, OnboardingStep } from "../../domains/onboarding/api/api";
import { effectiveStep } from "../../domains/onboarding/logic/steps";
import type { OnboardingState } from "../../domains/onboarding/hooks/useOnboarding";
import {
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  TODAY_PATH,
  isAuthPath,
  isShellPath,
  isWelcomePath,
  normalizePath,
  safeWantedPath,
  stepFromPath,
  stepPath,
} from "./routes";

export type OnboardingInput =
  | { kind: "loading" }
  | { kind: "problem" }
  | { kind: "ready"; position: OnboardingPosition };

/** What the route decision needs of the saved progress; `null` when no session is mounted (signed out). */
export function onboardingInput(state: OnboardingState | null): OnboardingInput {
  if (state === null) return { kind: "loading" };
  if (state.kind === "problem") return { kind: "problem" };
  if (state.kind === "ready") return { kind: "ready", position: state.position };
  return { kind: "loading" };
}

export interface RouteInput {
  auth: "loading" | "signed-out" | "signed-in";
  onboarding: OnboardingInput;
  pathname: string;
  /** Where a signed-out person was headed; used only when they land on an auth path while signed in. */
  wanted: string | null;
  hasPendingInvite: boolean;
  /** The onboarding steps that apply on this device. */
  steps: readonly OnboardingStep[];
}

export type RouteDecision =
  | { kind: "wait" }
  /** The saved progress could not be read: show "Try again", never a guess. */
  | { kind: "retry" }
  | { kind: "render" }
  | { kind: "redirect"; to: string };

const render: RouteDecision = { kind: "render" };
const redirect = (to: string): RouteDecision => ({ kind: "redirect", to });

/** The one place that decides where a User may be. Pure, so a table test can prove it never loops. */
export function resolveRoute(input: RouteInput): RouteDecision {
  const path = normalizePath(input.pathname);

  if (input.auth === "loading") return { kind: "wait" };

  if (input.auth === "signed-out") {
    if (isAuthPath(path)) return render;
    return redirect(input.hasPendingInvite ? SIGN_UP_PATH : SIGN_IN_PATH);
  }

  // Signed in on an auth screen: decide for the place they were headed, in one hop.
  if (isAuthPath(path)) {
    // `wanted` is raw router state: it is sanitised here, once, so the table test covers it.
    const target = safeWantedPath(input.wanted) ?? TODAY_PATH;
    const decision = resolveSignedIn(input, target);
    return decision.kind === "render" ? redirect(target) : decision;
  }
  return resolveSignedIn(input, path);
}

function resolveSignedIn(input: RouteInput, path: string): RouteDecision {
  // A pending Invite wins over onboarding and the other tabs: joining is how this person gets a Home.
  if (input.hasPendingInvite) return path === TODAY_PATH ? render : redirect(TODAY_PATH);

  const { onboarding, steps } = input;
  if (onboarding.kind === "loading") return { kind: "wait" };
  if (onboarding.kind === "problem") return { kind: "retry" };

  const frontier = effectiveStep(steps, onboarding.position);
  if (frontier === "done") {
    if (isWelcomePath(path) || !isShellPath(path)) return redirect(TODAY_PATH);
    return render;
  }

  const step = stepFromPath(path);
  // Going back is allowed; a step ahead of the saved one, or one that does not apply here, is not.
  if (step !== null && steps.includes(step) && steps.indexOf(step) <= steps.indexOf(frontier)) return render;
  return redirect(stepPath(frontier));
}
