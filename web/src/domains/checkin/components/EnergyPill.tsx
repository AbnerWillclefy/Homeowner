import { CircleAlert, Moon, Zap, Check, type LucideIcon } from "lucide-react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { SkeletonPill } from "../../../shared/ui/Skeleton";
import { useDelayedFlag } from "../../../shared/ui/useDelayedFlag";
import { energyPill, pillWidthTexts, type PillIcon, type PillInput } from "../logic/energyPill";

const ICONS: Record<Exclude<PillIcon, "none">, LucideIcon> = { zap: Zap, moon: Moon, check: Check, alert: CircleAlert };

// Whole class strings, so Tailwind finds them. The loading box copies the button's size: the same padding, border
// and 2.75rem height, so nothing moves when the button takes its place.
const BOX = "inline-flex min-h-11 items-center justify-center rounded-pill border px-3 py-2 font-semibold whitespace-nowrap";

/**
 * Every text the pill can show, stacked in one grid cell and invisible, under the real one (when there is one). The
 * box is as wide as the widest text in this locale and at this text size from the first frame, with no width written
 * in pixels. Each ghost has the icon's slot, so the widest text with an icon sets the width.
 */
function Content({ texts, real }: { texts: string[]; real: { icon: PillIcon; text: string } | null }) {
  const Icon = real && real.icon !== "none" ? ICONS[real.icon] : null;
  return (
    <span className="grid">
      {texts.map((text) => (
        <span key={text} aria-hidden="true" className="invisible col-start-1 row-start-1 inline-flex items-center justify-center gap-1">
          <span className="size-4" />
          <span className="tabular-nums">{text}</span>
        </span>
      ))}
      {real && (
        <span className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1">
          {Icon && <Icon aria-hidden="true" size={16} />}
          <span className="tabular-nums">{real.text}</span>
        </span>
      )}
    </span>
  );
}

interface Props {
  /** The Check-in read's outcome and, once ready, the Energy note (from `energyNote`) and the plan's Energy. */
  input: PillInput;
  /** Opens the Check-in dialog. Gets the pill, so focus can return to it. */
  onOpen(opener: HTMLElement): void;
  /** Reads the Check-in and the Demands again, from the unavailable state. */
  onRetry(): void;
}

/**
 * Today's Energy in the top bar: a number in a bordered pill, or "Check-in" with a dashed edge until the Resident
 * has checked in today. Tapping it opens the Check-in dialog (or, when the read failed, tries it again). The text
 * and the accessible name say the whole state; the dashed edge and the icon only add to them. Neutral ink in every
 * state, never the accent (The One Voice Rule). While the Check-in loads it is an empty box of its final size (a
 * pulse after 300ms), and `aria-hidden`, because the bar is not a place to announce a wait.
 */
export function EnergyPill({ input, onOpen, onRetry }: Props) {
  const { t, locale } = useI18n();
  const format = (n: number) => new Intl.NumberFormat(locale).format(n);
  const view = energyPill(t, input, format);
  const texts = pillWidthTexts(t, input.kind === "ready" && input.energy !== null ? format(input.energy) : format(0));
  const loading = view.kind === "loading";
  const showSkeleton = useDelayedFlag(loading);

  if (loading) {
    return (
      <span aria-hidden="true" className={`${BOX} relative border-transparent`}>
        <Content texts={texts} real={null} />
        {showSkeleton && (
          <span className="absolute inset-0">
            <SkeletonPill className="h-full! w-full" />
          </span>
        )}
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      aria-label={view.name}
      onClick={(event) => (view.kind === "failed" ? onRetry() : onOpen(event.currentTarget))}
      className={`px-3! whitespace-nowrap ${view.dashed ? "border-dashed" : ""}`}
    >
      <Content texts={texts} real={view} />
    </Button>
  );
}
