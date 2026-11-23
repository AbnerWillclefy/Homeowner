import { BottomBar, Button, Sidebar, SidebarBrand, type NavItem } from "@homeowner/bedrock";
import { MessageCircle } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useOpenBills } from "../domains/bills/hooks/useOpenBills";
import { useUpdatedNote } from "../domains/sources/hooks/useUpdatedNote";
import { HideValuesProvider } from "../shared/HideValues";
import { useI18n } from "../shared/i18n/I18nProvider";
import { useMediaQuery } from "../shared/useMediaQuery";
import { useNow } from "../shared/useNow";
import { useSyncOnLaunch } from "../domains/settings/hooks/useNotifications";
import { screenKeyOf } from "../domains/chat/logic/screenKeys";
import { BILLS, CHAT, MORE, MORE_ROWS, NAV_FOOTER, NAV_GROUPS, OVERVIEW, PANTRY_LIST, PLAN, PLAN_ROWS, TABS, type Screen } from "./screens";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";
// The Ask button is 48px (control-lg), fixed: 16px from the right, 16px above the BottomBar (its 48px row, 1px border and 16px padding, plus the safe area) on the phone, 32px from the corner on desktop.
const ASK_ABOVE_BAR = "bottom-[calc(5.0625rem+env(safe-area-inset-bottom))]";
// Room for it under the last row, owned here so no screen needs its own: button 48px + gap + air (the artboards' 96px phone, 112px desktop).
const ASK_ROOM = "pb-24 desktop:pb-28";

/** The frame of every signed-in screen: Sidebar from 1024px up, BottomBar below, with the screen in between. */
export function Shell() {
  return (
    <HideValuesProvider>
      <Frame />
    </HideValuesProvider>
  );
}

function Frame() {
  const { t } = useI18n();
  const now = useNow();
  const openBills = useOpenBills(now);
  const desktop = useMediaQuery(DESKTOP);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  useSyncOnLaunch();

  const item = (s: Screen): NavItem => ({
    // The chat remembers the screen it was opened from; on the chat itself the link keeps its own `from`.
    href: s === CHAT ? `${s.path}${pathname === s.path ? search : `?from=${screenKeyOf(pathname)}`}` : s.path,
    label: t(s.label),
    icon: s.icon,
    current: s.path === pathname,
    ...(s.path === BILLS.path && openBills ? { badge: { count: openBills, label: t("nav.bills.badge", { n: openBills }) } } : {}),
  });
  const updated = useUpdatedNote(now);
  // A tab is current on its own path; Planejar and Mais also on the screens their rows open and their drill-downs (a Spending Category, the Shopping list under the Pantry).
  const under: Record<string, Screen[]> = { [PLAN.path]: PLAN_ROWS, [MORE.path]: MORE_ROWS.flat() };
  const tab = (s: Screen): NavItem => ({
    ...item(s),
    // The Sidebar keeps "Visão geral"; the first tab is "Início".
    label: t(s === OVERVIEW ? "nav.home" : s.label),
    current: s.path === pathname || !!under[s.path]?.some((r) => pathname.startsWith(`${r.path}/`) || r.path === pathname),
    // The Bills badge moves to Mais, where its row is.
    ...(s === MORE && openBills ? { badge: { count: openBills, label: t("nav.bills.badge", { n: openBills }) } } : {}),
  });
  // Not on the chat, nor on a phone's Shopping list, whose dock sits where the button would.
  const ask = pathname !== CHAT.path && (desktop || pathname !== PANTRY_LIST.path);

  return (
    <div className="flex min-h-dvh desktop:items-start">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-(--z-overlay) focus:rounded-md focus:bg-surface-raised focus:p-4">
        {t("app.skip")}
      </a>
      {desktop && (
        <div className="sticky top-0 h-dvh shrink-0">
          <Sidebar
            label={t("nav.label")}
            brand={<SidebarBrand name={t("app.name")} />}
            note={updated}
            groups={NAV_GROUPS.map((g) => ({ label: t(g.label), items: g.screens.map(item) }))}
            footer={NAV_FOOTER.map(item)}
            onNavigate={(href) => void navigate(href)}
          />
        </div>
      )}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className={`mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 pt-6 outline-none desktop:px-10 desktop:pt-8 ${ask ? ASK_ROOM : "pb-10 desktop:pb-12"}`}>
          <Outlet />
          {ask && (
            <Button asChild size="lg" className={`fixed right-4 z-(--z-sticky) rounded-full px-5 shadow-lg ${ASK_ABOVE_BAR} desktop:right-8 desktop:bottom-8`}>
              <Link to={`${CHAT.path}?from=${screenKeyOf(pathname)}`}>
                <MessageCircle aria-hidden className="size-4" />
                {t("nav.ask")}
              </Link>
            </Button>
          )}
        </main>
        {!desktop && pathname !== CHAT.path && (
          <div className="sticky bottom-0 z-(--z-sticky)">
            <BottomBar
              label={t("nav.label")}
              items={TABS.map(tab)}
              onNavigate={(href) => void navigate(href)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
