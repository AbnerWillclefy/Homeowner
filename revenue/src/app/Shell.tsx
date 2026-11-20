import { BottomBar, Button, Sheet, Sidebar, SidebarBrand, type NavItem } from "@homeowner/bedrock";
import { useQuery } from "@tanstack/react-query";
import { Ellipsis, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { getBills } from "../domains/bills/api";
import { billsKey } from "../domains/bills/hooks/useBills";
import { summarise } from "../domains/bills/logic/billState";
import { useSources } from "../domains/sources/hooks/useSources";
import { HideValuesProvider } from "../shared/HideValues";
import { useI18n } from "../shared/i18n/I18nProvider";
import { saoPauloDay } from "../shared/month/month";
import { timeAgo } from "../shared/timeAgo";
import { useMediaQuery } from "../shared/useMediaQuery";
import { useSyncOnLaunch } from "../domains/settings/hooks/useNotifications";
import { screenKeyOf } from "../domains/chat/logic/screenKeys";
import { BILLS, CHAT, MORE, NAV_FOOTER, NAV_GROUPS, TABS, type Screen } from "./screens";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";
const MORE_HREF = "#more";
// The Ask button is 48px (control-lg), fixed: 16px from the right, 16px above the BottomBar (its 48px row, 1px border and 16px padding, plus the safe area) on the phone, 32px from the corner on desktop.
const ASK_ABOVE_BAR = "bottom-[calc(5.0625rem+env(safe-area-inset-bottom))]";
// Room for it under the last row, owned here so no screen needs its own: button 48px + gap + air (the artboards' 96px phone, 112px desktop).
const ASK_ROOM = "pb-24 desktop:pb-28";

/** A clock that moves every minute, so "Atualizado há 2 min" and the São Paulo month never go stale. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** The Bills of this month still to pay. Same query key as BillsPage, so marking one paid moves the badge at once. Undefined while loading or failed: never "0". */
function useOpenBills(now: Date) {
  const today = saoPauloDay(now);
  const { data } = useQuery({ queryKey: billsKey(today.slice(0, 7)), queryFn: () => getBills(today.slice(0, 7)) });
  // Card bills from commitments are not counted: the badge counts the Bills to pay rows, as the Bills artboard does.
  return data && summarise(data).toPayCount;
}

/** The frame of every signed-in screen: Sidebar from 1024px up, BottomBar below, with the screen in between. */
export function Shell() {
  return (
    <HideValuesProvider>
      <Frame />
    </HideValuesProvider>
  );
}

function Frame() {
  const { t, locale } = useI18n();
  const now = useNow();
  const openBills = useOpenBills(now);
  const sources = useSources().data;
  const desktop = useMediaQuery(DESKTOP);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  useSyncOnLaunch();

  const item = (s: Screen): NavItem => ({
    // The chat remembers the screen it was opened from; on the chat itself the link keeps its own `from`.
    href: s === CHAT ? `${s.path}${pathname === s.path ? search : `?from=${screenKeyOf(pathname)}`}` : s.path,
    label: t(s.label),
    icon: s.icon,
    current: s.path === pathname,
    ...(s.path === BILLS.path && openBills ? { badge: { count: openBills, label: t("nav.bills.badge", { n: openBills }) } } : {}),
  });
  const updated = sources?.importing ? t("sources.importing") : sources?.lastSyncedAt && t("nav.updated", { when: timeAgo(sources.lastSyncedAt, now, locale) });
  const onNavigate = (href: string) => {
    if (href === MORE_HREF) setMoreOpen(true);
    else void navigate(href);
  };
  const moreItems = MORE.map(item);
  const ask = pathname !== CHAT.path;

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
            onNavigate={onNavigate}
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
              items={[...TABS.map(item), { href: MORE_HREF, label: t("nav.more"), icon: Ellipsis, current: moreItems.some((i) => i.current) }]}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </div>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen} title={t("nav.more")} closeLabel={t("app.close")}>
        <ul className="flex flex-col gap-1">
          {moreItems.map((i) => (
            <li key={i.href}>
              <a
                href={i.href}
                aria-current={i.current ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setMoreOpen(false);
                  void navigate(i.href);
                }}
                className="body-strong flex h-control-lg items-center gap-3 rounded-md px-2 text-text-muted hover:bg-surface-hover aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand"
              >
                <i.icon aria-hidden className="size-5 shrink-0" />
                {i.label}
              </a>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
