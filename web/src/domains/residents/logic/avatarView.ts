import { initials } from "./initials";

export type AvatarView = { kind: "photo"; url: string } | { kind: "initials"; letters: string } | { kind: "icon" };

/**
 * What an Avatar draws. The photo shows while there is a URL that has not failed to load; `failedUrl` is the last
 * URL whose image errored, so a new URL is tried again without any reset. A missing avatar can come back as 200
 * `text/html`, so only the image's own decode error tells us, and that error lands here as `failedUrl`.
 * Otherwise initials, or the neutral icon when the name gives no letters.
 */
export function avatarView({ name, photoUrl, failedUrl }: { name: string; photoUrl: string | null; failedUrl: string | null }): AvatarView {
  if (photoUrl !== null && photoUrl !== failedUrl) return { kind: "photo", url: photoUrl };
  const letters = initials(name);
  return letters === "" ? { kind: "icon" } : { kind: "initials", letters };
}
