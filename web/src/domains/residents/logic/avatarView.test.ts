import { describe, expect, it } from "vitest";
import { avatarView } from "./avatarView";

const resident = (over: { initials?: string; avatarTone?: string; photoUrl?: string | null }) => ({
  initials: "AS",
  avatarTone: "kitchen",
  photoUrl: null,
  ...over,
});

describe("avatarView", () => {
  it("shows the photo when there is a URL and it has not failed", () => {
    expect(avatarView(resident({ photoUrl: "https://cdn.test/a.jpg" }), null)).toEqual({ kind: "photo", url: "https://cdn.test/a.jpg" });
  });

  it("falls back to the server's initials once that URL failed to load", () => {
    expect(avatarView(resident({ photoUrl: "https://cdn.test/a.jpg" }), "https://cdn.test/a.jpg")).toEqual({
      kind: "initials",
      letters: "AS",
      tone: "peach",
    });
  });

  it("tries a new URL again after an earlier one failed", () => {
    expect(avatarView(resident({ photoUrl: "https://cdn.test/b.jpg" }), "https://cdn.test/a.jpg")).toEqual({
      kind: "photo",
      url: "https://cdn.test/b.jpg",
    });
  });

  it("shows initials when there is no photo", () => {
    expect(avatarView(resident({ initials: "AW" }), null)).toEqual({ kind: "initials", letters: "AW", tone: "peach" });
  });

  it.each([
    ["kitchen", "peach"],
    ["bathroom", "mint"],
    ["bedroom", "lavender"],
    ["laundry", "blue"],
    ["trash", "yellow"],
    ["pets", "salmon"],
  ])("maps the Category id %s to the %s pastel", (avatarTone, tone) => {
    expect(avatarView(resident({ avatarTone }), null)).toEqual({ kind: "initials", letters: "AS", tone });
  });

  it("uses the neutral tone for a tone the app does not know", () => {
    expect(avatarView(resident({ avatarTone: "spaceship" }), null)).toEqual({ kind: "initials", letters: "AS", tone: "neutral" });
  });

  it("shows the neutral icon when there are no initials and no usable photo", () => {
    expect(avatarView(resident({ initials: "" }), null)).toEqual({ kind: "icon" });
    expect(avatarView(resident({ initials: "", photoUrl: "https://cdn.test/a.jpg" }), "https://cdn.test/a.jpg")).toEqual({ kind: "icon" });
  });

  it("shows the neutral icon when there is no Resident", () => {
    expect(avatarView(null, null)).toEqual({ kind: "icon" });
  });
});
