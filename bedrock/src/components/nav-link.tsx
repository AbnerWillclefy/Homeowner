import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "../lib/cn";

/** A destination. The package never knows the router: `current` comes from the app. */
export type NavItem = { href: string; label: string; icon: LucideIcon; current?: boolean };

type Props = {
  item: NavItem;
  onNavigate?: (href: string) => void;
  className?: string;
  children: ReactNode;
};

/** A real link, so middle click and open-in-new-tab keep working; a plain click goes to `onNavigate`. */
export function NavLink({ item, onNavigate, className, children }: Props) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (!onNavigate || !plain) return;
    e.preventDefault();
    onNavigate(item.href);
  };
  return (
    <a
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
