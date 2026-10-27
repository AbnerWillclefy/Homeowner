import { describe, expect, it } from "vitest";
import { dialogToShow, type FlowNotice } from "./dialogToShow";

type Input = Parameters<typeof dialogToShow>[0];

const TODAY = "2030-01-15";
const YESTERDAY = "2030-01-14";

/** A quiet launch on Today: nothing pending, a Check-in that is still due. */
const base: Input = {
  onToday: true,
  inviteToken: null,
  after: null,
  choosing: false,
  checkIn: { date: TODAY, checkedIn: false },
  checkInDismissedFor: null,
};
const withState = (changes: Partial<Input>): Input => ({ ...base, ...changes });

describe("dialogToShow", () => {
  it("shows nothing when nothing is pending and the Check-in is not loaded", () => {
    expect(dialogToShow(withState({ checkIn: null }))).toBeNull();
  });

  it("does not make a dialog of the already-here notice", () => {
    expect(dialogToShow(withState({ after: "already-here", checkIn: null }))).toBeNull();
  });

  it("shows the start choice after the already-here notice", () => {
    expect(dialogToShow(withState({ after: "already-here", choosing: true }))).toBe("start-choice");
  });

  it("shows the start choice alone", () => {
    expect(dialogToShow(withState({ choosing: true }))).toBe("start-choice");
  });

  it("shows rating after a join", () => {
    expect(dialogToShow(withState({ after: "rating" }))).toBe("rating");
  });

  it("holds the start choice back while rating shows", () => {
    expect(dialogToShow(withState({ after: "rating", choosing: true }))).toBe("rating");
  });

  it.each<[FlowNotice | null, boolean]>([
    [null, false],
    [null, true],
    ["rating", false],
    ["rating", true],
    ["already-here", false],
    ["already-here", true],
  ])("shows join first with a pending Invite (after %s, choosing %s)", (after, choosing) => {
    expect(dialogToShow(withState({ inviteToken: "abc", after, choosing }))).toBe("join");
  });

  describe("the Check-in", () => {
    it("opens on a new Check-in day", () => {
      expect(dialogToShow(base)).toBe("checkin");
    });

    it("stays closed when dismissed for this date", () => {
      expect(dialogToShow(withState({ checkInDismissedFor: TODAY }))).toBeNull();
    });

    it("opens again when it was dismissed for another date", () => {
      expect(dialogToShow(withState({ checkInDismissedFor: YESTERDAY }))).toBe("checkin");
    });

    it("stays closed once the Resident has checked in", () => {
      expect(dialogToShow(withState({ checkIn: { date: TODAY, checkedIn: true } }))).toBeNull();
    });

    it("stays closed until the Check-in is loaded", () => {
      expect(dialogToShow(withState({ checkIn: null }))).toBeNull();
    });

    it("waits behind a pending Invite", () => {
      expect(dialogToShow(withState({ inviteToken: "abc" }))).toBe("join");
    });

    it("waits behind the rating step", () => {
      expect(dialogToShow(withState({ after: "rating" }))).toBe("rating");
    });

    it("waits behind the start choice", () => {
      expect(dialogToShow(withState({ choosing: true }))).toBe("start-choice");
    });

    it("does not wait behind the already-here notice, which is not a dialog", () => {
      expect(dialogToShow(withState({ after: "already-here" }))).toBe("checkin");
    });

    it("stays closed off Today", () => {
      expect(dialogToShow(withState({ onToday: false }))).toBeNull();
    });
  });

  it("shows no session dialog off Today either", () => {
    expect(dialogToShow(withState({ onToday: false, inviteToken: "abc", after: "rating", choosing: true }))).toBeNull();
  });
});
