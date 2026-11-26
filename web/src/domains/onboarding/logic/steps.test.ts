import { describe, expect, it } from "vitest";
import { effectiveStep, nextStep, pathAfterAdvance, previousStep, progress, stepAfter, stepsFor } from "./steps";
import { screenFromId, screenOf, reportedStep } from "./screens";

const CREATOR = stepsFor(false);
const JOINER = stepsFor(true);

describe("stepsFor", () => {
  it("gives the creator five screens, install and reminders sharing the last", () => {
    expect(CREATOR).toEqual(["home", "baseline", "restrictions", "preferences", "finish"]);
  });

  it("drops the Home screen for a joiner", () => {
    expect(JOINER).toEqual(["baseline", "restrictions", "preferences", "finish"]);
  });
});

describe("progress", () => {
  it("counts the creator's screens as n of 5", () => {
    expect(CREATOR.map((s) => progress(CREATOR, s))).toEqual([
      { step: 1, total: 5 },
      { step: 2, total: 5 },
      { step: 3, total: 5 },
      { step: 4, total: 5 },
      { step: 5, total: 5 },
    ]);
  });

  it("counts the joiner's screens as n of 4", () => {
    expect(JOINER.map((s) => progress(JOINER, s))).toEqual([
      { step: 1, total: 4 },
      { step: 2, total: 4 },
      { step: 3, total: 4 },
      { step: 4, total: 4 },
    ]);
  });
});

describe("effectiveStep", () => {
  it.each(["install", "reminders"] as const)("shows stored %s on the finish screen, whatever the device", (stored) => {
    expect(effectiveStep(CREATOR, stored)).toBe("finish");
    expect(effectiveStep(JOINER, stored)).toBe("finish");
  });

  it("keeps a step that has its own screen", () => {
    expect(effectiveStep(CREATOR, "baseline")).toBe("baseline");
    expect(effectiveStep(CREATOR, "preferences")).toBe("preferences");
  });

  it("moves a joiner's stored home to the Baseline", () => {
    expect(effectiveStep(JOINER, "home")).toBe("baseline");
  });

  it("keeps done", () => {
    expect(effectiveStep(CREATOR, "done")).toBe("done");
  });
});

describe("screens and the step they report", () => {
  it("maps both stored last steps to finish and the rest to themselves", () => {
    expect(screenOf("install")).toBe("finish");
    expect(screenOf("reminders")).toBe("finish");
    expect(screenOf("restrictions")).toBe("restrictions");
  });

  it("reports reminders from finish, which moves the server past install too", () => {
    expect(reportedStep("finish")).toBe("reminders");
    expect(reportedStep("preferences")).toBe("preferences");
  });

  it("reads an old install or reminders address as finish, and rejects unknown ids", () => {
    expect(screenFromId("install")).toBe("finish");
    expect(screenFromId("reminders")).toBe("finish");
    expect(screenFromId("finish")).toBe("finish");
    expect(screenFromId("nope")).toBeNull();
  });
});

describe("nextStep and previousStep", () => {
  it("walks forward in order and ends at done", () => {
    expect(nextStep(CREATOR, "home")).toBe("baseline");
    expect(nextStep(CREATOR, "preferences")).toBe("finish");
    expect(nextStep(CREATOR, "finish")).toBe("done");
    expect(nextStep(JOINER, "finish")).toBe("done");
  });

  it("walks back, and stops at the first screen", () => {
    expect(previousStep(CREATOR, "restrictions")).toBe("baseline");
    expect(previousStep(CREATOR, "finish")).toBe("preferences");
  });

  it("never goes back to home once it exists, and a joiner has none to go back to", () => {
    expect(previousStep(CREATOR, "baseline")).toBeNull();
    expect(previousStep(JOINER, "baseline")).toBeNull();
  });
});

describe("stepAfter", () => {
  it("moves one screen on from the one just finished", () => {
    expect(stepAfter(CREATOR, "home", "baseline")).toBe("baseline");
  });

  it("does not jump to the stored step when the User had gone back", () => {
    expect(stepAfter(CREATOR, "baseline", "install")).toBe("restrictions");
  });

  it("follows the server to done", () => {
    expect(stepAfter(CREATOR, "finish", "done")).toBe("done");
  });
});

describe("pathAfterAdvance", () => {
  it("goes to the next screen's path, and from Preferences to finish", () => {
    expect(pathAfterAdvance(CREATOR, "home", "baseline")).toBe("/welcome/baseline");
    expect(pathAfterAdvance(CREATOR, "preferences", "install")).toBe("/welcome/finish");
  });

  it("goes from finish to the end", () => {
    expect(pathAfterAdvance(CREATOR, "finish", "done")).toBeNull();
  });

  it("goes one screen on, not to the stored step, after going back", () => {
    expect(pathAfterAdvance(CREATOR, "baseline", "reminders")).toBe("/welcome/restrictions");
  });
});
