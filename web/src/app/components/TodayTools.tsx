import { StreakButton } from "../../domains/streak/components/StreakButton";
import { MicButton } from "../../domains/voice/components/MicButton";
import { useMicHidden } from "../../domains/voice/hooks/useMicHidden";
import { recognitionCtor } from "../../domains/voice/logic/speech";
import { useShell } from "./ShellContext";

/**
 * Today's tools, in the `tools` slot of its page header: the Streak chip, then the voice microphone in a 2.75rem
 * slot (the touch target, no more) that exists only where the browser has speech recognition. The Energy is on the
 * hero card, as on the Hoje artboards. The Streak's slot is reserved from the first frame, whatever the data, so
 * filling it moves nothing; it fills only once the Home is ready (see `useStreak`). On a Drained day the Streak
 * shows paused. The group is never wider than 45% of the screen and wraps, so at the largest text size the title
 * keeps room beside it.
 */
export function TodayTools() {
  const { streak, note } = useShell();
  // Set after a "service not allowed" error (Siri off in Safari): the mic stays away until the app reloads.
  const micHidden = useMicHidden();
  return (
    <div data-testid="today-tools" className="flex max-w-[45vw] flex-wrap items-center justify-end gap-2">
      <div data-slot="streak" className="flex min-h-11 min-w-16 items-center justify-end">
        <StreakButton streak={streak.streak} loading={streak.loading} paused={note === "drained"} />
      </div>
      {recognitionCtor(window) && !micHidden && (
        <div data-slot="voice" className="flex h-11 min-w-11 items-center justify-end">
          <MicButton />
        </div>
      )}
    </div>
  );
}
