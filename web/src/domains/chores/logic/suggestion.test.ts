import { describe, expect, it } from "vitest";
import { suggestTwoPerson, TWO_PERSON_EFFORT_THRESHOLD } from "./suggestion";

describe("suggestTwoPerson", () => {
  it("suggests it for a one-person Chore at the threshold Effort", () => {
    expect(suggestTwoPerson(4, 1)).toBe(true);
    expect(suggestTwoPerson(5, 1)).toBe(true);
  });

  it("does not suggest it just below the threshold", () => {
    expect(suggestTwoPerson(3, 1)).toBe(false);
    expect(suggestTwoPerson(1, 1)).toBe(false);
  });

  it("does not suggest it once the Chore takes two people", () => {
    expect(suggestTwoPerson(5, 2)).toBe(false);
  });

  it("keeps the threshold at 4, the decision recorded on the ticket", () => {
    expect(TWO_PERSON_EFFORT_THRESHOLD).toBe(4);
  });
});
