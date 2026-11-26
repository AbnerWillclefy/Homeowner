import { describe, expect, it } from "vitest";
import { avatarTone } from "./avatarView";

const resident = (avatarTone: string) => ({ initials: "AS", avatarTone, photoUrl: null });

describe("avatarTone", () => {
  it.each([
    ["kitchen", "kitchen"],
    ["bathroom", "bathroom"],
    ["bedroom", "bedroom"],
    ["laundry", "laundry"],
    ["trash", "trash"],
    ["pets", "pets"],
  ])("maps the Category id %s to the chore-%s tone", (id, tone) => {
    expect(avatarTone(resident(id))).toBe(tone);
  });

  it("uses the other tone for an id the app does not know", () => {
    expect(avatarTone(resident("spaceship"))).toBe("other");
    expect(avatarTone(resident(""))).toBe("other");
  });
});
