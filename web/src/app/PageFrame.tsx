import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { HealthBanner } from "./HealthBanner";

/** The one centred column every screen sits in: the app name, the tagline, the health banner, then the screen. */
export function PageFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <main tabIndex={-1} className={`page w-full focus:outline-none ${className}`}>
      <h1>{t("app.name")}</h1>
      <p>{t("home.tagline")}</p>
      <HealthBanner />
      {children}
    </main>
  );
}
