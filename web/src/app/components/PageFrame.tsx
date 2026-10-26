import type { ReactNode } from "react";
import { Logo } from "../../shared/ui/Logo";
import { HealthBanner } from "./HealthBanner";

/**
 * The one centred column every screen sits in: the top of the page, the health banner, then the screen. The top is
 * the logo alone (the page's `h1`) unless the caller passes its own, as the Shell passes the top bar, which holds
 * the logo as the `h1`. There is exactly one `h1` per screen.
 */
export function PageFrame({
  children,
  className = "",
  top = <Logo />,
}: {
  children: ReactNode;
  className?: string;
  top?: ReactNode;
}) {
  return (
    <main
      tabIndex={-1}
      className={`page w-full focus:outline-none ${className}`}
    >
      <div className="mb-6">{top}</div>
      <HealthBanner />
      {children}
    </main>
  );
}
