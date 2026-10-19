import { describe, expect, it } from "vitest";
import { avatarTone } from "./avatarTone";
import { avatarView } from "./avatarView";

const resident = (over: { name?: string; photoUrl?: string | null }) => ({ name: "Ana Souza", userId: "u-1", photoUrl: null, ...over });

describe("avatarView", () => {
  it("shows the photo when there is a URL and it has not failed", () => {
    expect(avatarView(resident({ photoUrl: "https://cdn.test/a.jpg" }), null)).toEqual({ kind: "photo", url: "https://cdn.test/a.jpg" });
  });

  it("falls back to initials, with the tone of the user id, once that URL failed to load", () => {
    expect(avatarView(resident({ photoUrl: "https://cdn.test/a.jpg" }), "https://cdn.test/a.jpg")).toEqual({
      kind: "initials",
      letters: "AS",
      tone: avatarTone("u-1"),
    });
  });

  it("tries a new URL again after an earlier one failed", () => {
    expect(avatarView(resident({ name: "Ana", photoUrl: "https://cdn.test/b.jpg" }), "https://cdn.test/a.jpg")).toEqual({
      kind: "photo",
      url: "https://cdn.test/b.jpg",
    });
  });

  it("shows initials when there is no photo", () => {
    expect(avatarView(resident({ name: "abner.w" }), null)).toEqual({ kind: "initials", letters: "AW", tone: avatarTone("u-1") });
  });

  it("takes the tone from the user id, never the name", () => {
    const view = avatarView({ name: "Ana", userId: "someone-else", photoUrl: null }, null);
    expect(view).toEqual({ kind: "initials", letters: "A", tone: avatarTone("someone-else") });
  });

  it("shows the neutral icon when the name gives no letters and there is no usable photo", () => {
    expect(avatarView(resident({ name: "" }), null)).toEqual({ kind: "icon" });
    expect(avatarView(resident({ name: "", photoUrl: "https://cdn.test/a.jpg" }), "https://cdn.test/a.jpg")).toEqual({ kind: "icon" });
  });

  it("shows the neutral icon when there is no Resident", () => {
    expect(avatarView(null, null)).toEqual({ kind: "icon" });
  });
});
