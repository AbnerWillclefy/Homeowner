import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingPosition } from "../api/api";
import { onboardingKey, onboardingQuery } from "../api/queries";
import { viewOf } from "../../../shared/query/view";
import { onboardingStateOf } from "../logic/onboardingState";

export type { OnboardingProblem, OnboardingState } from "../logic/onboardingState";

/**
 * Where the signed-in User is in onboarding, read from the server because progress has to survive leaving
 * Safari for the Home Screen app, which has its own storage. Only mounted while signed in (see App).
 * When the first read fails there is no guess: the person sees the problem and can retry. A position that was
 * read stays `ready` while it is read again, so a refocus mid-walk never flips the guard to "wait".
 * The server only stores what a step report sent, so a read cannot run ahead of the walk.
 */
export function useOnboarding() {
  const query = useQuery(onboardingQuery);
  const queryClient = useQueryClient();
  const { refetch } = query;

  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  /** The step report's answer goes straight into the cache. A read still in flight is cancelled so its older answer cannot lower it. */
  const setPosition = useCallback(
    (position: OnboardingPosition) => {
      void queryClient.cancelQueries({ queryKey: onboardingKey, exact: true });
      queryClient.setQueryData<OnboardingPosition>(onboardingKey, position);
    },
    [queryClient],
  );

  return { state: onboardingStateOf(viewOf(query).state), retry, setPosition };
}
