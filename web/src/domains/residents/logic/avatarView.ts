import type { CategoryTone } from "../../chores/logic/categoryStyle";
import { avatarTone } from "./avatarTone";
import { initials } from "./initials";

export type AvatarView =
  | { kind: "photo"; url: string }
  | { kind: "initials"; letters: string; tone: CategoryTone }
  | { kind: "icon" };

/**
 * What an Avatar draws. The photo shows while there is a URL that has not failed to load; `failedUrl` is the last
 * URL whose image errored, so a new URL is tried again without any reset. A missing avatar can come back as 200
 * `text/html`, so only the image's own decode error tells us, and that error lands here as `failedUrl`.
 * Otherwise initials on the pastel from the user id, or the neutral icon when the name gives no letters or there
 * is no Resident (`null`: the list is loading, or the id is unknown).
 */
export function avatarView(
  resident: { name: string; userId: string; photoUrl: string | null } | null,
  failedUrl: string | null,
): AvatarView {
  if (resident === null) return { kind: "icon" };
  if (resident.photoUrl !== null && resident.photoUrl !== failedUrl) return { kind: "photo", url: resident.photoUrl };
  const letters = initials(resident.name);
  return letters === "" ? { kind: "icon" } : { kind: "initials", letters, tone: avatarTone(resident.userId) };
}
