import { describe, expect, it } from "vitest";
import { dialogToShow, type FlowNotice } from "./dialogToShow";

describe("dialogToShow", () => {
  it("shows nothing when nothing is pending", () => {
    expect(dialogToShow({ inviteToken: null, after: null, choosing: false })).toBeNull();
  });

  it("does not make a dialog of the already-here notice", () => {
    expect(dialogToShow({ inviteToken: null, after: "already-here", choosing: false })).toBeNull();
  });

  it("shows the start choice after the already-here notice", () => {
    expect(dialogToShow({ inviteToken: null, after: "already-here", choosing: true })).toBe("start-choice");
  });

  it("shows the start choice alone", () => {
    expect(dialogToShow({ inviteToken: null, after: null, choosing: true })).toBe("start-choice");
  });

  it("shows rating after a join", () => {
    expect(dialogToShow({ inviteToken: null, after: "rating", choosing: false })).toBe("rating");
  });

  it("holds the start choice back while rating shows", () => {
    expect(dialogToShow({ inviteToken: null, after: "rating", choosing: true })).toBe("rating");
  });

  it.each<[FlowNotice | null, boolean]>([
    [null, false],
    [null, true],
    ["rating", false],
    ["rating", true],
    ["already-here", false],
    ["already-here", true],
  ])("shows join first with a pending Invite (after %s, choosing %s)", (after, choosing) => {
    expect(dialogToShow({ inviteToken: "abc", after, choosing })).toBe("join");
  });
});
