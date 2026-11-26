import { describe, expect, it } from "vitest";
import { effectiveStep, nextStep, pathAfterAdvance, previousStep, progress, stepAfter, stepsFor } from "./steps";

const IOS_TAB = { kind: "needs-install" } as const;
const ANDROID = { kind: "available" } as const;
const IOS_STANDALONE = { kind: "available" } as const;
const UNSUPPORTED = { kind: "unsupported" } as const;

describe("stepsFor", () => {
  it("includes install only on iOS in a browser tab", () => {
    expect(stepsFor(IOS_TAB)).toEqual(["home", "baseline", "restrictions", "preferences", "install", "reminders"]);
  });

  it.each([
    ["Android", ANDROID],
    ["iOS from the Home Screen", IOS_STANDALONE],
    ["a browser without push", UNSUPPORTED],
  ])("leaves install out on %s", (_name, availability) => {
    expect(stepsFor(availability)).toEqual(["home", "baseline", "restrictions", "preferences", "reminders"]);
  });
});

describe("effectiveStep", () => {
  const steps = stepsFor(ANDROID);

  it("keeps a step that applies", () => {
    expect(effectiveStep(steps, "baseline")).toBe("baseline");
  });

  it("moves a stored step that does not apply on this device to the next one that does", () => {
    expect(effectiveStep(steps, "preferences")).toBe("preferences");
    expect(effectiveStep(steps, "install")).toBe("reminders");
  });

  it("keeps done", () => {
    expect(effectiveStep(steps, "done")).toBe("done");
  });
});

describe("nextStep and previousStep", () => {
  const steps = stepsFor(IOS_TAB);

  it("walks forward in order and ends at done", () => {
    expect(nextStep(steps, "home")).toBe("baseline");
    expect(nextStep(steps, "preferences")).toBe("install");
    expect(nextStep(steps, "reminders")).toBe("done");
  });

  it("walks back, and stops at the first step", () => {
    expect(previousStep(steps, "restrictions")).toBe("baseline");
    expect(previousStep(steps, "reminders")).toBe("install");
  });

  it("never goes back to home, where a second Home would be created", () => {
    expect(previousStep(steps, "baseline")).toBeNull();
    expect(previousStep(stepsFor(ANDROID), "baseline")).toBeNull();
  });
});

describe("stepAfter", () => {
  const steps = stepsFor(ANDROID);

  it("moves one step on from the step just finished", () => {
    expect(stepAfter(steps, "home", "baseline")).toBe("baseline");
  });

  it("does not jump to the stored step when the User had gone back", () => {
    expect(stepAfter(steps, "baseline", "preferences")).toBe("restrictions");
  });

  it("follows the server to done", () => {
    expect(stepAfter(steps, "reminders", "done")).toBe("done");
  });
});

describe("pathAfterAdvance", () => {
  it("goes to the next step's path after a normal advance", () => {
    expect(pathAfterAdvance(stepsFor(ANDROID), "home", "baseline")).toBe("/welcome/baseline");
  });

  it("skips install when it does not apply", () => {
    expect(pathAfterAdvance(stepsFor(ANDROID), "preferences", "reminders")).toBe("/welcome/reminders");
    expect(pathAfterAdvance(stepsFor(IOS_TAB), "preferences", "install")).toBe("/welcome/install");
  });

  it("goes from reminders to the end", () => {
    expect(pathAfterAdvance(stepsFor(ANDROID), "reminders", "done")).toBeNull();
  });

  it("goes one step on, not to the stored step, after going back", () => {
    expect(pathAfterAdvance(stepsFor(ANDROID), "baseline", "preferences")).toBe("/welcome/restrictions");
  });

  it("is null when the server says done", () => {
    expect(pathAfterAdvance(stepsFor(ANDROID), "baseline", "done")).toBeNull();
  });
});

describe("progress", () => {
  it("numbers the steps that apply on this device", () => {
    expect(progress(stepsFor(IOS_TAB), "install")).toEqual({ step: 5, total: 6 });
    expect(progress(stepsFor(ANDROID), "home")).toEqual({ step: 1, total: 5 });
    expect(progress(stepsFor(ANDROID), "reminders")).toEqual({ step: 5, total: 5 });
  });
});
