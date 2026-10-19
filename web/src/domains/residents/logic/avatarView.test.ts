import { describe, expect, it } from "vitest";
import { avatarView } from "./avatarView";

describe("avatarView", () => {
  it("shows the photo when there is a URL and it has not failed", () => {
    expect(avatarView({ name: "Ana Souza", photoUrl: "https://cdn.test/a.jpg", failedUrl: null })).toEqual({ kind: "photo", url: "https://cdn.test/a.jpg" });
  });

  it("falls back to initials once that URL failed to load", () => {
    expect(avatarView({ name: "Ana Souza", photoUrl: "https://cdn.test/a.jpg", failedUrl: "https://cdn.test/a.jpg" })).toEqual({
      kind: "initials",
      letters: "AS",
    });
  });

  it("tries a new URL again after an earlier one failed", () => {
    expect(avatarView({ name: "Ana", photoUrl: "https://cdn.test/b.jpg", failedUrl: "https://cdn.test/a.jpg" })).toEqual({
      kind: "photo",
      url: "https://cdn.test/b.jpg",
    });
  });

  it("shows initials when there is no photo", () => {
    expect(avatarView({ name: "abner.w", photoUrl: null, failedUrl: null })).toEqual({ kind: "initials", letters: "AW" });
  });

  it("shows the neutral icon when the name gives no letters and there is no usable photo", () => {
    expect(avatarView({ name: "", photoUrl: null, failedUrl: null })).toEqual({ kind: "icon" });
    expect(avatarView({ name: "", photoUrl: "https://cdn.test/a.jpg", failedUrl: "https://cdn.test/a.jpg" })).toEqual({ kind: "icon" });
  });
});
