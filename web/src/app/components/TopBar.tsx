import { EnergyPill } from "../../domains/checkin/components/EnergyPill";
import { pillInput } from "../../domains/checkin/logic/energyPill";
import { StreakButton } from "../../domains/streak/components/StreakButton";
import { Logo } from "../../shared/ui/Logo";
import { useShell } from "./ShellContext";

/**
 * The quiet bar above every tab: the logo (the page's `h1`) on the left, and on the right two fixed slots, the Energy
 * indicator and the Streak, each a 4rem ghost icon button. The bar reserves its whole height and both slots from the
 * first frame, whatever the data: its row is at least the 2.75rem touch target and each slot is never narrower than
 * 4rem, so filling either moves nothing, and at 320px and the default text size it stays on one row. The right group
 * never shrinks and the bar wraps, so at the largest text size on a narrow phone the two drop under the logo, on the
 * right, instead of being pushed off screen. Both fill their slots only once the Home is ready (see `useStreak`,
 * `useCheckIn`); until then the slots are empty. The indicator opens the Shell's one Check-in dialog.
 */
export function TopBar() {
  const { streak, checkIn, note, energy, home, openCheckIn, pillRef } = useShell();
  const input = pillInput({ checkInState: checkIn.state, note, energy, homeReady: home.state.kind === "ready" });
  return (
    <header data-testid="top-bar" className="flex min-h-11 flex-wrap items-center justify-between">
      <div className="min-w-0 max-w-full">
        <Logo />
      </div>
      {/* No gaps and -mr-2: the buttons carry their own 0.5rem padding, and the 4rem slots plus the logo only fit
          the 17rem column at 320px this way. */}
      <div className="-mr-2 ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end">
        <div data-slot="energy" className="flex min-h-11 min-w-16 items-center justify-end">
          {input && <EnergyPill input={input} buttonRef={pillRef} onOpen={openCheckIn} onRetry={() => void checkIn.reload()} />}
        </div>
        <div data-slot="streak" className="flex h-11 min-w-16 items-center justify-end">
          <StreakButton streak={streak.streak} loading={streak.loading} />
        </div>
      </div>
    </header>
  );
}
