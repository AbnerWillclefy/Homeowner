import { UserRound } from "lucide-react";
import { useState } from "react";
import { toneClasses } from "../../chores/logic/categoryStyle";
import { avatarTone } from "../logic/avatarTone";
import { avatarView } from "../logic/avatarView";

interface Props {
  name: string;
  userId: string;
  photoUrl: string | null;
  /** sm for lists and the greeting row, lg for the Me header. */
  size: "sm" | "lg";
}

// Whole class strings, because Tailwind scans for literal names. rem sizes: 2.75rem is the touch-target size.
const SIZES = {
  sm: { box: "size-11 text-base", icon: 20 },
  lg: { box: "size-24 text-4xl", icon: 40 },
} as const;

/**
 * A Resident's face: their photo, or else initials on a pastel picked from a hash of the user id, so the same
 * person always gets the same colours. It is decorative (`alt=""`): the name is always written next to it. If
 * the photo fails to load it falls back to the initials; a missing photo can arrive as a 200 `text/html`, so
 * the image's `onError` is the only signal. With no name it shows a neutral person icon on the plain card, which
 * is also the placeholder while the Residents list loads, in the same box so nothing jumps.
 */
export function Avatar({ name, userId, photoUrl, size }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const view = avatarView({ name, photoUrl, failedUrl });
  const { box, icon } = SIZES[size];
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill border border-border font-bold ${box}`;

  if (view.kind === "photo") {
    return (
      <span className={`${base} bg-surface`} aria-hidden="true">
        <img
          src={view.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailedUrl(view.url)}
        />
      </span>
    );
  }
  if (view.kind === "initials") {
    const tone = toneClasses(avatarTone(userId));
    return (
      <span className={`${base} ${tone.fill} ${tone.ink}`} aria-hidden="true">
        {view.letters}
      </span>
    );
  }
  return (
    <span className={`${base} bg-surface-raised text-muted`} aria-hidden="true">
      <UserRound size={icon} />
    </span>
  );
}
