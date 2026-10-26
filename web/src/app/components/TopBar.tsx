import { StreakButton } from "../../domains/streak/components/StreakButton";
import { Logo } from "../../shared/ui/Logo";
import { useShell } from "./ShellContext";

/**
 * The quiet bar above every tab: the logo (the page's `h1`) on the left, and on the right two fixed slots, an Energy
 * slot that is empty for now and the Streak slot. The bar reserves its whole height and both slots from the first
 * frame, whatever the data: its row is at least the 2.75rem touch target, the Streak slot is never narrower than
 * its 4rem button, and the empty Energy slot sits between them and the logo, so filling it later moves nothing. The
 * right group never shrinks; the logo side does, so pt-BR at the largest text size cannot push the Streak off screen.
 * The Streak fills its slot only once the Home is ready (see `useStreak`); until then the slot is empty.
 */
export function TopBar() {
  const { streak } = useShell();
  return (
    <header data-testid="top-bar" className="flex min-h-11 items-center justify-between gap-2">
      <div className="min-w-0">
        <Logo />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div data-slot="energy" />
        <div data-slot="streak" className="flex h-11 min-w-16 items-center justify-end">
          <StreakButton streak={streak.streak} loading={streak.loading} />
        </div>
      </div>
    </header>
  );
}
