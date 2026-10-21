import type { AxiosRequestConfig } from "axios";
import { authedRequest } from "../../auth/api/client";

/** The ids are stored on the server, so they are permanent. Order matters: this is the walk. */
export const ONBOARDING_STEPS = ["install", "reminders", "baseline", "restrictions", "preferences", "home"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The step to show, or `done`. */
export type OnboardingPosition = OnboardingStep | "done";

/** The steps the client reports as completed or skipped. `home` is completed by creating the Home. */
export type ReportableStep = Exclude<OnboardingStep, "home">;

export type OnboardingResult =
  | { kind: "ok"; step: OnboardingPosition }
  | { kind: "not-signed-in" }
  /** The API could not be reached. */
  | { kind: "offline" }
  | { kind: "error" };

function isPosition(value: unknown): value is OnboardingPosition {
  return value === "done" || (ONBOARDING_STEPS as readonly unknown[]).includes(value);
}

async function call(init?: AxiosRequestConfig): Promise<OnboardingResult> {
  try {
    const result = await authedRequest({ ...init, url: "/me/onboarding" });
    if (result.kind === "not-signed-in") return result;
    if (result.response.status !== 200) return { kind: "error" };
    const body = result.response.data as { step?: unknown } | null;
    return isPosition(body?.step) ? { kind: "ok", step: body.step } : { kind: "error" };
  } catch {
    return { kind: "offline" };
  }
}

/** Where the signed-in User is in onboarding: the step to show next. */
export const getOnboarding = (): Promise<OnboardingResult> => call();

/** Records a step as completed or skipped. Never moves progress backwards; returns the step to show next. */
export const putOnboardingStep = (step: ReportableStep): Promise<OnboardingResult> =>
  call({ method: "PUT", headers: { "Content-Type": "application/json" }, data: JSON.stringify({ step }) });
