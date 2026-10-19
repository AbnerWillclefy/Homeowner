import { UserRound } from "lucide-react";
import { useState } from "react";
import { toneClasses } from "../../chores/logic/categoryStyle";
import { avatarTone } from "../logic/avatarTone";
import { avatarView, type AvatarView } from "../logic/avatarView";

interface Props {
  /** Who to draw, or null for the neutral placeholder (the list is loading, or the Resident is unknown). */
  resident: { name: string; userId: string; photoUrl: string | null } | null;
}

// 2.75rem is the touch-target size.
const BOX =
  "inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-pill border border-border text-base font-bold";

function fillFor(view: AvatarView, userId: string): string {
  if (view.kind === "photo") return "bg-surface";
  if (view.kind === "icon") return "bg-surface-raised text-muted";
  const tone = toneClasses(avatarTone(userId));
  return `${tone.fill} ${tone.ink}`;
}

/**
 * A Resident's face: their photo, or else initials on a pastel picked from a hash of the user id, so the same
 * person always gets the same colours. It is decorative (`alt=""`): the name is always written next to it. If
 * the photo fails to load it falls back to the initials; a missing photo can arrive as a 200 `text/html`, so
 * the image's `onError` is the only signal. With no Resident, or a name with no letters, it shows a neutral
 * person icon on the plain card, in the same box so nothing jumps while the Residents list loads.
 */
export function Avatar({ resident }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const view: AvatarView = resident ? avatarView({ name: resident.name, photoUrl: resident.photoUrl, failedUrl }) : { kind: "icon" };

  return (
    <span className={`${BOX} ${fillFor(view, resident?.userId ?? "")}`} aria-hidden="true">
      {view.kind === "photo" ? (
        <img
          src={view.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedUrl(view.url)}
        />
      ) : view.kind === "initials" ? (
        view.letters
      ) : (
        <UserRound size={20} />
      )}
    </span>
  );
}
