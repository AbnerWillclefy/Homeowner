import type { HTMLAttributes } from "react";
import { Card } from "./Card";

// Muted at low opacity, so it follows the theme. The pulse runs only when the Resident has not asked for reduced motion.
const PULSE_FILL = "bg-muted/20 motion-safe:animate-pulse";

interface Props {
  /** Size classes, for example `h-4 w-1/2`. A bar is 1rem high and full width without them. */
  className?: string;
}

// The parts carry no `aria-hidden` of their own: each skeleton is wrapped in an `aria-hidden` element
// (`SkeletonCard`, or the wrapper of a whole skeleton), and the page's status speaks instead.

/** A muted bar standing in for a line of text. */
export function SkeletonBar({ className = "h-4 w-full" }: Props) {
  return <span className={`block rounded-pill ${PULSE_FILL} ${className}`} />;
}

/** A muted pill standing in for a button, at the 44px touch target (2.75rem) by default. */
export function SkeletonPill({ className = "w-24" }: Props) {
  return <span className={`block h-11 rounded-pill ${PULSE_FILL} ${className}`} />;
}

/** A muted rounded square standing in for an `IconTile` (2.75rem). */
export function SkeletonTile({ className = "" }: Props) {
  return <span className={`block size-11 shrink-0 rounded-control ${PULSE_FILL} ${className}`} />;
}

/** A card outline holding skeleton parts. Hidden from screen readers as a whole. */
export function SkeletonCard({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card {...rest} aria-hidden="true" className={`flex flex-col gap-3 ${className}`}>
      {children}
    </Card>
  );
}
