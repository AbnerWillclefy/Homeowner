import { useId, type ReactNode } from "react";
import { NavLink, type NavItem } from "./nav-link";

type Props = {
  /** The nav landmark's accessible name. Unique on the page. */
  label: string;
  brand?: ReactNode;
  groups: { label: string; items: NavItem[] }[];
  /** Items pinned to the bottom, such as Settings. */
  footer?: NavItem[];
  onNavigate?: (href: string) => void;
};

// shortcut: no tooltip on collapsed items, add a Radix Tooltip if users miss labels
// Below the wide breakpoint labels and group names are sr-only, so the accessible name stays.
const hideCollapsed = "sr-only wide:not-sr-only";

function Items({ items, labelledBy, onNavigate }: { items: NavItem[]; labelledBy?: string; onNavigate?: (href: string) => void }) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <NavLink
            item={item}
            onNavigate={onNavigate}
            className="body flex h-control-md items-center justify-center gap-2 px-2 pointer-coarse:h-control-lg wide:justify-start"
          >
            <item.icon aria-hidden className="size-4 shrink-0" />
            <span className={`min-w-0 truncate ${hideCollapsed}`}>{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Group({ label, items, onNavigate }: { label: string; items: NavItem[]; onNavigate?: (href: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <p id={id} className={`overline px-2 uppercase text-text-muted ${hideCollapsed}`}>
        {label}
      </p>
      <Items items={items} labelledBy={id} onNavigate={onNavigate} />
    </div>
  );
}

export function Sidebar({ label, brand, groups, footer, onNavigate }: Props) {
  return (
    <nav
      aria-label={label}
      className="flex h-full w-sidebar-collapsed flex-col gap-6 border-r border-border bg-surface p-2 wide:w-sidebar"
    >
      {brand}
      <div className="flex flex-1 flex-col gap-6">
        {groups.map((g) => (
          <Group key={g.label} {...g} onNavigate={onNavigate} />
        ))}
      </div>
      {footer && <Items items={footer} onNavigate={onNavigate} />}
    </nav>
  );
}
