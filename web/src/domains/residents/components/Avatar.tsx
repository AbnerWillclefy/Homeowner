import { UserRound } from "lucide-react";
import { useState } from "react";
import { TONES } from "../../chores/logic/categoryStyle";
import { avatarView, type AvatarView } from "../logic/avatarView";

interface Props {
  /** Who to draw, or null for the neutral placeholder (the list is loading, or the Resident is unknown). */
  resident: { name: string; userId: string; photoUrl: string | null } | null;
}

// 2.75rem is the touch-target size.
const BOX =
  "inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-pill border border-border text-base font-bold";

function Face({ view, onError }: { view: AvatarView; onError: (url: string) => void }) {
  switch (view.kind) {
    case "photo":
      return (
        <span aria-hidden="true" className={`${BOX} bg-surface`}>
          <img src={view.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => onError(view.url)} />
        </span>
      );
    case "initials":
      return (
        <span aria-hidden="true" className={`${BOX} ${TONES[view.tone].fill} ${TONES[view.tone].ink}`}>
          {view.letters}
        </span>
      );
    case "icon":
      return (
        <span aria-hidden="true" className={`${BOX} bg-surface-raised text-muted`}>
          <UserRound size={20} />
        </span>
      );
  }
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
  return <Face view={avatarView(resident, failedUrl)} onError={setFailedUrl} />;
}
