import { useId, type ReactNode } from "react";
import { NavBadge, NavLink, type NavItem } from "./nav-link";
import { Tooltip } from "./tooltip";

type Props = {
  /** The nav landmark's accessible name. Unique on the page. */
  label: string;
  brand?: ReactNode;
  groups: { label: string; items: NavItem[] }[];
  /** Items pinned to the bottom, such as Settings. */
  footer?: NavItem[];
  /** Small text above the footer, such as "Updated 2 h ago". Hidden in the icon-only rail. */
  note?: ReactNode;
  onNavigate?: (href: string) => void;
};

// Below the wide breakpoint labels and group names are sr-only, so the accessible name stays;
// the Tooltip then shows the label visually, and wide:hidden drops it from the full Sidebar.
const hideCollapsed = "sr-only wide:not-sr-only";

function Items({ items, labelledBy, onNavigate }: { items: NavItem[]; labelledBy?: string; onNavigate?: (href: string) => void }) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.href}>
          <Tooltip label={item.label} className="wide:hidden">
            <NavLink
              item={item}
              onNavigate={onNavigate}
              className="body-strong relative flex h-control-md aria-[current=page]:bg-brand-soft items-center justify-center gap-2 px-2 pointer-coarse:h-control-lg wide:justify-start"
            >
              <item.icon aria-hidden className="size-4 shrink-0" />
              <span className={`min-w-0 truncate ${hideCollapsed}`}>{item.label}</span>
              {/* A dot-sized count on the icon in the rail, pushed right beside the label when wide. */}
              <NavBadge badge={item.badge} className="absolute top-0 right-0 h-4 px-1 wide:static wide:h-6 wide:px-2 wide:ml-auto" />
            </NavLink>
          </Tooltip>
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

/** The brand mark and name; the name drops out in the icon-only rail but stays in the accessible tree. */
export function SidebarBrand({ name }: { name: string }) {
  return (
    <p className="flex items-center justify-center gap-2 px-2 text-[18px]/6 font-bold tracking-tight wide:justify-start">
      <span aria-hidden className="size-6 shrink-0 rounded-md bg-brand" />
      <span className={hideCollapsed}>{name}</span>
    </p>
  );
}

export function Sidebar({ label, brand, groups, footer, note, onNavigate }: Props) {
  return (
    <nav
      aria-label={label}
      className="flex h-full w-sidebar-collapsed flex-col gap-6 border-r border-border bg-surface px-4 py-6 wide:w-sidebar"
    >
      {brand}
      <div className="flex flex-1 flex-col gap-6">
        {groups.map((g) => (
          <Group key={g.label} {...g} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {note && <div className="hidden px-2 caption text-text-muted wide:block">{note}</div>}
        {footer && <Items items={footer} onNavigate={onNavigate} />}
      </div>
    </nav>
  );
}
