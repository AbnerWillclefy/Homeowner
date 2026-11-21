import type { LucideIcon } from "lucide-react";
import type { ComponentProps, MouseEvent } from "react";
import { cn } from "../lib/cn";
import { Badge } from "./badge";

/** A destination. The package never knows the router: `current` comes from the app.
 * `badge.label` is the screen-reader wording for the count ("3 bills open"); a count of 0 or less shows nothing. */
export type NavItem = { href: string; label: string; icon: LucideIcon; current?: boolean; badge?: { count: number; label: string } };

/** The count, capped at "9+", with its wording sr-only so the link name is "Label, badge-label". `className` places it. */
export function NavBadge({ badge, className }: { badge: NavItem["badge"]; className?: string }) {
  if (!badge || badge.count <= 0) return null;
  return (
    <>
      <Badge tone="warning" aria-hidden className={cn("shrink-0", className)}>
        {badge.count > 9 ? "9+" : badge.count}
      </Badge>
      <span className="sr-only">, {badge.label}</span>
    </>
  );
}

type Props = Omit<ComponentProps<"a">, "href"> & {
  item: NavItem;
  onNavigate?: (href: string) => void;
};

/** A real link, so middle click and open-in-new-tab keep working; a plain click goes to `onNavigate`. */
export function NavLink({ item, onNavigate, className, onClick: outerClick, children, ...rest }: Props) {
  // ref and the rest reach the <a>, so a Tooltip trigger (asChild) can wrap it.
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    outerClick?.(e);
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!onNavigate || !plain) return;
    e.preventDefault();
    onNavigate(item.href);
  };
  return (
    <a
      {...rest}
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-md text-text-muted not-aria-[current=page]:hover:bg-surface-hover not-aria-[current=page]:active:bg-surface-hover aria-[current=page]:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
    >
      {children}
    </a>
  );
}
