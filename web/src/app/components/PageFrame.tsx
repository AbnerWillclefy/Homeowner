import type { ReactNode } from "react";
import { Logo } from "../../shared/ui/Logo";
import { HealthBanner } from "./HealthBanner";

/**
 * The one centred column every screen sits in: the top of the page, the health banner, then the screen. The top is
 * the logo alone (the page's `h1`) unless the caller passes its own, or `null` for none, as the Shell does: each of
 * its screens then opens with its own page header, which holds the `h1`. There is exactly one `h1` per screen.
 * With no top the frame is a tab's: it adds no block padding, because `TabHeader` and `TabBody` set the page spacing once.
 */
export function PageFrame({
  children,
  className = "",
  top = <Logo />,
}: {
  children: ReactNode;
  className?: string;
  top?: ReactNode | null;
}) {
  return (
    <main
      tabIndex={-1}
      className={`${top === null ? "tab-page" : "page"} w-full focus:outline-none ${className}`}
    >
      {top !== null && <div className="mb-6">{top}</div>}
      <HealthBanner />
      {children}
    </main>
  );
}
