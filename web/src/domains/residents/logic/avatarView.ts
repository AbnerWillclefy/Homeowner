import { choreCategory, type ChoreTone } from "../../chores/logic/choreCategory";

/** What the API sends to draw a face: `initials` and `avatarTone` (a Category id) are decided on the server. */
export interface AvatarSource {
  initials: string;
  avatarTone: string;
  photoUrl: string | null;
}

/** The `chore-*` tone of the server's `avatarTone` Category id; an id the app does not know is "other". */
export function avatarTone(resident: AvatarSource): ChoreTone {
  return choreCategory(resident.avatarTone).tone;
}
