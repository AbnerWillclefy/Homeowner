import { Zap } from "lucide-react";
import { Link } from "react-router";
import { ME_PATH } from "../app/routes";
import type { EnergyNote } from "../checkin/state";
import { Chip } from "../chores/Chip";
import { useI18n, type MessageKey } from "../shared/i18n";
import { greetingKey } from "./greeting";

// A note added without a text here fails the typecheck.
const CHIP_KEYS = {
  unset: "dayplan.chip.unset",
  "no-baseline": "dayplan.chip.noBaseline",
  drained: "dayplan.chip.drained",
  energy: "dayplan.chip.energy",
  pending: "dayplan.chip.pending",
} as const satisfies Record<EnergyNote, MessageKey>;

interface Props {
  /** The plan's Energy for the Resident; null until a plan is loaded. */
  energy: number | null;
  /** The chip's note, or null while today's Check-in is not known (loading or failed): then there is no chip. */
  note: EnergyNote | null;
  /** Opens the Check-in dialog; the chip is a button for it when there is no Check-in. */
  onOpenCheckIn(): void;
}

/**
 * The top of Today: a time-of-day greeting from the device's clock (no name) and today's Energy as a chip. The
 * chip advises and never pushes. It is a button to the Check-in when none exists, a link to the Baseline when
 * there is none, and plain text otherwise. The greeting is an h2 because the app name above is the page's h1,
 * and it is the first heading, which is where focus lands when the tab opens.
 */
export function TodayHeader({ energy, note, onOpenCheckIn }: Props) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col items-start gap-3">
      <h2 className="my-0 text-2xl font-bold">{t(greetingKey(new Date().getHours()))}</h2>
      {note && <EnergyChip note={note} energy={energy} onOpenCheckIn={onOpenCheckIn} />}
    </header>
  );
}

function EnergyChip({ note, energy, onOpenCheckIn }: { note: EnergyNote; energy: number | null; onOpenCheckIn(): void }) {
  const { t } = useI18n();
  const visible = t(CHIP_KEYS[note], { energy: energy ?? 0 });
  // One name for the whole chip, so a screen reader says what it is and its state; it contains the visible text.
  const content = (
    <>
      <span className="sr-only">{t("dayplan.chip.label", { text: visible })}</span>
      <span aria-hidden="true">{visible}</span>
    </>
  );

  if (note === "unset") {
    return (
      <Chip asChild icon={Zap}>
        <button type="button" onClick={onOpenCheckIn}>
          {content}
        </button>
      </Chip>
    );
  }
  if (note === "no-baseline") {
    return (
      <Chip asChild icon={Zap}>
        <Link to={ME_PATH}>{content}</Link>
      </Chip>
    );
  }
  return <Chip icon={Zap}>{content}</Chip>;
}
