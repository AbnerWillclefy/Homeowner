import { describe, expect, it } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import type { QuerySnapshot } from "../../../shared/query/view";
import { onboardingInput, resolveRoute } from "../../../app/logic/resolveRoute";
import type { OnboardingAnswer } from "../api/queries";
import { stepsFor } from "./steps";
import { onboardingStateOf } from "./onboardingState";

const stateOf = (snapshot: QuerySnapshot<OnboardingAnswer>) => onboardingStateOf(snapshot);

describe("onboardingStateOf", () => {
  it("is loading before the first answer", () => {
    expect(stateOf({ data: undefined, error: null, isFetching: true })).toEqual({ kind: "loading" });
  });

  it("is a problem with the failure kind when the first read fails", () => {
    expect(stateOf({ data: undefined, error: new ApiFailure("offline"), isFetching: false })).toEqual({
      kind: "problem",
      problem: "offline",
    });
  });

  it("stays ready when a refetch fails or runs behind a position on screen", () => {
    const ready = { kind: "ready", position: "baseline", joined: false };
    expect(stateOf({ data: { step: "baseline", joined: false }, error: new ApiFailure("offline"), isFetching: false })).toEqual(ready);
    expect(stateOf({ data: { step: "baseline", joined: false }, error: null, isFetching: true })).toEqual(ready);
  });

  it("never sends the guard back to wait or retry mid-walk, even when a refetch fails", () => {
    const state = stateOf({ data: { step: "baseline", joined: false }, error: new ApiFailure("error"), isFetching: false });
    const decision = resolveRoute({
      auth: "signed-in",
      onboarding: onboardingInput(state),
      pathname: "/welcome/baseline",
      wanted: null,
      hasPendingInvite: false,
      steps: stepsFor(false),
    });
    expect(decision).toEqual({ kind: "render" });
  });
});
