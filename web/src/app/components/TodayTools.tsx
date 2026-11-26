import { EnergyPill } from "../../domains/checkin/components/EnergyPill";
import { pillInput } from "../../domains/checkin/logic/energyPill";
import { StreakButton } from "../../domains/streak/components/StreakButton";
import { MicButton } from "../../domains/voice/components/MicButton";
import { useMicHidden } from "../../domains/voice/hooks/useMicHidden";
import { recognitionCtor } from "../../domains/voice/logic/speech";
import { useShell } from "./ShellContext";

/**
 * Today's tools, in the `tools` slot of its page header: the Energy indicator and the Streak, each a 4rem ghost icon
 * button in a fixed slot, then the voice microphone in a 2.75rem slot (the touch target, no more) that exists only
 * where the browser has speech recognition. The data slots are reserved from the first frame, whatever the data, so
 * filling either moves nothing. Both fill their slots only once the Home is ready (see `useStreak`, `useCheckIn`);
 * until then the slots are empty. The indicator opens the Shell's one Check-in dialog. The group is never wider than 45% of
 * the screen and wraps, so at the largest text size the title keeps room beside it.
 */
export function TodayTools() {
  const { streak, checkIn, note, energy, home, openCheckIn, pillRef } = useShell();
  // Set after a "service not allowed" error (Siri off in Safari): the mic stays away until the app reloads.
  const micHidden = useMicHidden();
  const input = pillInput({ checkInState: checkIn.state, note, energy, homeReady: home.state.kind === "ready" });
  return (
    <div data-testid="today-tools" className="flex max-w-[45vw] flex-wrap items-center justify-end">
      <div data-slot="energy" className="flex min-h-11 min-w-16 items-center justify-end">
        {input && <EnergyPill input={input} buttonRef={pillRef} onOpen={openCheckIn} onRetry={() => void checkIn.reload()} />}
      </div>
      <div data-slot="streak" className="flex h-11 min-w-16 items-center justify-end">
        <StreakButton streak={streak.streak} loading={streak.loading} />
      </div>
      {recognitionCtor(window) && !micHidden && (
        <div data-slot="voice" className="flex h-11 min-w-11 items-center justify-end">
          <MicButton />
        </div>
      )}
    </div>
  );
}
