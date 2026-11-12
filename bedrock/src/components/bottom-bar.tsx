import { NavLink, type NavItem } from "./nav-link";

type Props = {
  /** The nav landmark's accessible name. Unique on the page. */
  label: string;
  /** Three to five destinations. */
  items: NavItem[];
  onNavigate?: (href: string) => void;
};

// The app positions the bar (fixed bars use z-(--z-sticky)). env() is 0 unless the viewport meta has viewport-fit=cover.
export function BottomBar({ label, items, onNavigate }: Props) {
  return (
    <nav
      aria-label={label}
      className="border-t border-border bg-surface pb-[calc(var(--space-16)+env(safe-area-inset-bottom))]"
    >
      <ul className="grid grid-flow-col auto-cols-fr">
        {items.map((item) => (
          <li key={item.href} className="min-w-0">
            <NavLink
              item={item}
              onNavigate={onNavigate}
              className="flex min-h-control-lg flex-col items-center justify-center gap-1 px-1"
            >
              <item.icon aria-hidden className="size-5" />
              {/* 11/16 weight 500 is the spec's bottom-bar label size, which has no token. */}
              <span className="max-w-full truncate px-1 text-[11px]/4 font-medium">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
