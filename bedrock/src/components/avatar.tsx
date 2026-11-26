import { UserRound } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";

type AvatarSize = "sm" | "md" | "lg";

type AvatarProps = {
  /** The photo. If it fails to load (a missing photo can arrive as a 200 `text/html`) the initials show instead. */
  src?: string | null;
  /** One or two letters. With neither a photo nor initials the neutral person icon shows. */
  initials?: string;
  /** Fill class of the initials circle, for example `bg-brand-soft`. Core does not know the app's palette, so the app passes it. */
  fillClass?: string;
  /** Ink class of the initials, for example `text-brand`. */
  inkClass?: string;
  /** `sm` 32px (dense cards), `md` 40px (rows), `lg` 72px (the top of a person's page). */
  size?: AvatarSize;
  className?: string;
};

// Whole class strings, so Tailwind finds them.
const SIZES: Record<AvatarSize, { box: string; icon: string }> = {
  sm: { box: "size-8 text-xs", icon: "size-4" },
  md: { box: "size-10 text-sm", icon: "size-5" },
  lg: { box: "size-18 text-2xl", icon: "size-9" },
};

/** Decorative: the person's name is always written beside it, so it is `aria-hidden` and the image has `alt=""`. */
export function Avatar({ src, initials, fillClass = "bg-brand-soft", inkClass = "text-brand", size = "md", className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const { box, icon } = SIZES[size];
  const frame = cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold", box, className);
  if (src && src !== failedSrc) {
    return (
      <span aria-hidden="true" className={cn(frame, "bg-surface")}>
        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" onError={() => setFailedSrc(src)} />
      </span>
    );
  }
  if (initials) {
    return (
      <span aria-hidden="true" className={cn(frame, fillClass, inkClass)}>
        {initials}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn(frame, "bg-surface-sunken text-text-muted")}>
      <UserRound className={icon} />
    </span>
  );
}

export type { AvatarProps, AvatarSize };
