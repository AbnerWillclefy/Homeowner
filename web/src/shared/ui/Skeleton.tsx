import type { HTMLAttributes } from "react";
import { Card } from "./Card";

// Muted at low opacity, so it follows the theme. The pulse runs only when the Resident has not asked for reduced motion.
const FILL = "bg-muted/20 rounded-pill motion-safe:animate-pulse";

interface Props {
  /** Size classes, for example `h-4 w-1/2`. A bar is 1rem high and full width without them. */
  className?: string;
}

/** A muted bar standing in for a line of text. Hidden from screen readers: the page's status speaks instead. */
export function SkeletonBar({ className = "h-4 w-full" }: Props) {
  return <span aria-hidden="true" className={`block ${FILL} ${className}`} />;
}

/** A muted pill standing in for a button, at the 44px touch target (2.75rem) by default. */
export function SkeletonPill({ className = "w-24" }: Props) {
  return <span aria-hidden="true" className={`block h-11 ${FILL} ${className}`} />;
}

/** A card outline holding skeleton parts. Hidden from screen readers as a whole. */
export function SkeletonCard({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card {...rest} aria-hidden="true" className={`flex flex-col gap-3 ${className}`}>
      {children}
    </Card>
  );
}
