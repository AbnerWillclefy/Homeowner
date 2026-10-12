import { CalendarCheck, House, ListChecks, User, type LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { useI18n } from "../shared/i18n";
import { NAV_ITEMS, type NavIcon } from "./navItems";
import { TODAY_PATH } from "./routes";

const ICONS: Record<NavIcon, LucideIcon> = {
  today: CalendarCheck,
  chores: ListChecks,
  home: House,
  me: User,
};

/**
 * The four tabs. It sits at the bottom of the viewport in the same centred column as the page, keeps the device's
 * bottom inset, has targets of at least 2.75rem and lets labels wrap at the largest text size. It is in the flow
 * after the content (sticky), so it never covers anything.
 */
export function BottomNav() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("nav.label")}
      className="sticky bottom-0 border-t border-border bg-surface-raised pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto m-0 flex max-w-[32rem] list-none p-0">
        {NAV_ITEMS.map(({ path, labelKey, icon }) => {
          const Icon = ICONS[icon];
          return (
            <li key={path} className="m-0 flex-1">
              <NavLink
                to={path}
                end={path === TODAY_PATH}
                className={({ isActive }) =>
                  `flex min-h-11 flex-col items-center justify-start gap-1 border-t-4 px-1 py-2 text-center text-sm no-underline ${
                    isActive ? "border-accent font-semibold text-accent" : "border-transparent text-muted"
                  }`
                }
              >
                <Icon aria-hidden="true" size={24} className="shrink-0" />
                <span>{t(labelKey)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
