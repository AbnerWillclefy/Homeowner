import { queryOptions } from "@tanstack/react-query";
import { toQueryData } from "../../../shared/query/ApiFailure";
import { refetchUnlessSucceeded } from "../../../shared/query/queryClient";
import { getOnboarding, type OnboardingPosition } from "./api";

/** `GET /me/onboarding`, under `me` (ADR 0013): sign-out clears it with the rest. */
export const onboardingKey = ["me", "onboarding"] as const;

/**
 * Where the User is in onboarding: the step to show, or `done`. The step report (`PUT /me/onboarding`) answers
 * with the next position and writes it here; it is not a query. The queryFn throws an `ApiFailure` on a failed call.
 */
export const onboardingQuery = queryOptions({
  queryKey: onboardingKey,
  queryFn: async (): Promise<OnboardingPosition> => toQueryData(await getOnboarding()).step,
  refetchOnMount: refetchUnlessSucceeded,
});
