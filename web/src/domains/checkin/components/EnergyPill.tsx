import { CircleAlert, Moon, Zap, Check, type LucideIcon } from "lucide-react";
import type { RefObject } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { SkeletonPill } from "../../../shared/ui/Skeleton";
import { useDelayedFlag } from "../../../shared/ui/useDelayedFlag";
import { energyPill, type PillIcon, type PillInput } from "../logic/energyPill";

const ICONS: Record<PillIcon, LucideIcon> = { zap: Zap, moon: Moon, check: Check, alert: CircleAlert };

interface Props {
  /** The Check-in read's outcome and, once ready, the Energy note (from `energyNote`) and the plan's Energy. */
  input: PillInput;
  /** The indicator button, for the Shell: focus returns to it when the dialog opens by itself. */
  buttonRef: RefObject<HTMLButtonElement | null>;
  /** Opens the Check-in dialog. Gets the button, so focus can return to it. */
  onOpen(opener: HTMLElement): void;
  /** Reads the Check-in and the Demands again, from the unavailable state. */
  onRetry(): void;
}

/**
 * Today's Energy in the top bar, looking like the Streak: a ghost icon button with a 20px icon and a short bold
 * value, never a word, so the bar stays on one row. No Check-in today shows a muted Zap and "?". Tapping it opens
 * the Check-in dialog (or, when the read failed, tries it again). The `aria-label` says the whole state and what a
 * tap does; the glyphs only add to it. Neutral ink in every state, never the accent (The One Voice Rule). While the
 * Check-in loads it is an empty `aria-hidden` box of the Streak's size (a pulse after 300ms), because the bar is not
 * a place to announce a wait.
 */
export function EnergyPill({ input, buttonRef, onOpen, onRetry }: Props) {
  const { t, locale } = useI18n();
  const showSkeleton = useDelayedFlag(input.kind === "loading");

  if (input.kind === "loading") {
    return (
      <div aria-hidden="true" className="flex h-11 w-16 items-center">
        {showSkeleton && <SkeletonPill className="w-full" />}
      </div>
    );
  }

  const view = energyPill(t, input, (n) => new Intl.NumberFormat(locale).format(n));
  const Icon = ICONS[view.icon];
  return (
    <Button
      variant="ghost"
      ref={buttonRef}
      aria-label={view.name}
      onClick={(event) => (view.kind === "failed" ? onRetry() : onOpen(event.currentTarget))}
      className={`min-w-16 gap-1 px-2! ${view.muted ? "text-muted" : ""}`}
    >
      <Icon aria-hidden="true" size={20} />
      <span className="font-bold tabular-nums">{view.text}</span>
    </Button>
  );
}
