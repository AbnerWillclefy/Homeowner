import { EnergyPill } from "../../domains/checkin/components/EnergyPill";
import type { PillInput } from "../../domains/checkin/logic/energyPill";
import { StreakButton } from "../../domains/streak/components/StreakButton";
import { Logo } from "../../shared/ui/Logo";
import { useShell } from "./ShellContext";

/**
 * The quiet bar above every tab: the logo (the page's `h1`) on the left, and on the right two fixed slots, the Energy
 * pill and the Streak. The bar reserves its whole height and both slots from the first frame, whatever the data: its
 * row is at least the 2.75rem touch target, the Streak slot is never narrower than its 4rem button, and the pill is
 * as wide as its widest state in the current locale and text size (see `EnergyPill`), so filling either moves
 * nothing. The right group never shrinks and the bar wraps, so at the largest text size on a narrow phone the pill
 * and the Streak drop under the logo, on the right, instead of being pushed off screen. The wrap is the same while
 * they load and after. Both fill their slots only once the Home is ready (see `useStreak`, `useCheckIn`); until
 * then the slots are empty. The pill opens the Shell's one Check-in dialog.
 */
export function TopBar() {
  const { streak, checkIn, note, energy, home, openCheckIn } = useShell();
  const input: PillInput | null =
    checkIn.state.kind === "failed"
      ? { kind: "failed" }
      : checkIn.state.kind === "ready" && note !== null
        ? { kind: "ready", note, energy, level: checkIn.state.checkIn.level }
        : home.state.kind === "ready"
          ? { kind: "loading" }
          : null;
  return (
    <header data-testid="top-bar" className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
      <div className="min-w-0 max-w-full">
        <Logo />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div data-slot="energy" className="flex min-h-11 items-center">
          {input && <EnergyPill input={input} onOpen={openCheckIn} onRetry={() => void checkIn.reload()} />}
        </div>
        <div data-slot="streak" className="flex h-11 min-w-16 items-center justify-end">
          <StreakButton streak={streak.streak} loading={streak.loading} />
        </div>
      </div>
    </header>
  );
}
