import { BottomBar, Sheet, Sidebar, type NavItem } from "@homeowner/bedrock";
import { Ellipsis } from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { useI18n } from "../shared/i18n/I18nProvider";
import { useMediaQuery } from "../shared/useMediaQuery";
import { MORE, NAV_FOOTER, NAV_GROUPS, TABS, type Screen } from "./screens";

// Duplicates --bp-desktop in Bedrock's tokens.css: matchMedia cannot read custom properties.
const DESKTOP = "(min-width: 1024px)";
const MORE_HREF = "#more";

/** The frame of every signed-in screen: Sidebar from 1024px up, BottomBar below, with the screen in between. */
export function Shell() {
  const { t } = useI18n();
  const desktop = useMediaQuery(DESKTOP);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const item = (s: Screen): NavItem => ({ href: s.path, label: t(s.label), icon: s.icon, current: s.path === pathname });
  const onNavigate = (href: string) => {
    if (href === MORE_HREF) setMoreOpen(true);
    else void navigate(href);
  };
  const moreItems = MORE.map(item);

  return (
    <div className="flex min-h-dvh desktop:items-start">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-(--z-overlay) focus:rounded-md focus:bg-surface-raised focus:p-4">
        {t("app.skip")}
      </a>
      {desktop && (
        <div className="sticky top-0 h-dvh shrink-0">
          <Sidebar
            label={t("nav.label")}
            brand={<p className="label px-2 py-2 text-brand">{t("app.name")}</p>}
            groups={NAV_GROUPS.map((g) => ({ label: t(g.label), items: g.screens.map(item) }))}
            footer={NAV_FOOTER.map(item)}
            onNavigate={onNavigate}
          />
        </div>
      )}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 p-4 outline-none desktop:p-8">
          <Outlet />
        </main>
        {!desktop && (
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
