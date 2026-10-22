import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../../../shared/query/ApiFailure";
import { createTestQueryClient } from "../../../shared/query/testing";
import type { OnboardingResult } from "./api";

const getOnboarding = vi.fn<() => Promise<OnboardingResult>>();
vi.mock("./api", () => ({ getOnboarding: () => getOnboarding() }));

const { onboardingKey, onboardingQuery } = await import("./queries");

describe("onboardingQuery", () => {
  beforeEach(() => getOnboarding.mockReset());

  it("has a key under me, shaped like the API path", () => {
    expect(onboardingKey).toEqual(["me", "onboarding"]);
    expect(onboardingQuery.queryKey).toEqual(["me", "onboarding"]);
  });

  it("returns the position the server gave", async () => {
    getOnboarding.mockResolvedValue({ kind: "ok", step: "baseline" });
    expect(await createTestQueryClient().fetchQuery(onboardingQuery)).toBe("baseline");
  });

  it.each(["offline", "error", "not-signed-in"] as const)("throws an ApiFailure of kind %s", async (kind) => {
    getOnboarding.mockResolvedValue({ kind });
    const failure = await createTestQueryClient().fetchQuery(onboardingQuery).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiFailure);
    expect((failure as ApiFailure).kind).toBe(kind);
  });
});
