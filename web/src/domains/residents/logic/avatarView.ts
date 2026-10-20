import { categoryStyle, type CategoryTone } from "../../chores/logic/categoryStyle";

export type AvatarView =
  | { kind: "photo"; url: string }
  | { kind: "initials"; letters: string; tone: CategoryTone }
  | { kind: "icon" };

/** What the API sends to draw a face: `initials` and `avatarTone` (a Category id) are decided on the server. */
export interface AvatarSource {
  initials: string;
  avatarTone: string;
  photoUrl: string | null;
}

/**
 * What an Avatar draws. The photo shows while there is a URL that has not failed to load; `failedUrl` is the last
 * URL whose image errored, so a new URL is tried again without any reset. A missing avatar can come back as 200
 * `text/html`, so only the image's own decode error tells us, and that error lands here as `failedUrl`.
 * Otherwise the server's initials on the pastel of its Category id (kitchen is peach, and so on), or the neutral
 * icon when there are no initials or no Resident (`null`: the list is loading, or the id is unknown).
 */
export function avatarView(resident: AvatarSource | null, failedUrl: string | null): AvatarView {
  if (resident === null) return { kind: "icon" };
  if (resident.photoUrl !== null && resident.photoUrl !== failedUrl) return { kind: "photo", url: resident.photoUrl };
  if (resident.initials === "") return { kind: "icon" };
  return { kind: "initials", letters: resident.initials, tone: categoryStyle(resident.avatarTone).tone };
}
