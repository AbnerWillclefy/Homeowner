import { afterEach, describe, expect, it, vi } from "vitest";
import { markOnboardingDone, onboardingDone, ONBOARDING_DONE_KEY } from "./onboardingDone";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("onboardingDone", () => {
  it("reads the flag from localStorage", () => {
    expect(onboardingDone()).toBe(false);
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
    expect(onboardingDone()).toBe(true);
  });

  it("writes the flag, and still reads it as done when storage refuses", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } });
    markOnboardingDone();
    expect(onboardingDone()).toBe(true);
  });
});
