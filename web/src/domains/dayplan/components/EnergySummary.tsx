import { Moon, Zap } from "lucide-react";
import { Link } from "react-router";
import { ME_PATH } from "../../../app/logic/routes";
import type { EnergyNote } from "../../checkin/logic/state";
import { useI18n } from "../../../shared/i18n";

// Above this many points the meter is one bar instead of a segment per point.
const MAX_SEGMENTS = 12;

/** Whether there is any Energy to show: none before a Check-in, or while the plan has no Energy yet. */
export function showsEnergy(note: EnergyNote | null): note is "drained" | "no-baseline" | "energy" {
  return note === "drained" || note === "no-baseline" || note === "energy";
}

interface Props {
  note: "drained" | "no-baseline" | "energy";
  /** The plan's Energy for the Resident. */
  energy: number;
  /** The Effort of the Resident's own Tasks today. */
  planned: number;
}

/**
 * Today's Energy, as text, never styled as a control: the points and how much of them the plan uses, that the
 * Resident is Drained, or a real link to set a Baseline.
 */
export function EnergySummary({ note, energy, planned }: Props) {
  const { t } = useI18n();

  if (note === "drained") {
    return (
      <p className="my-0 flex items-center gap-2 text-lg font-bold">
        <Moon aria-hidden="true" size={20} className="shrink-0 text-accent" />
        {t("dayplan.energy.drained")}
      </p>
    );
  }
  if (note === "no-baseline") {
    return (
      <Link to={ME_PATH} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-[0.2em]">
        {t("dayplan.energy.noBaseline")}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="my-0 flex items-center gap-2 text-lg font-bold">
        <Zap aria-hidden="true" size={20} className="shrink-0 text-accent" />
        {t("dayplan.energy.value", { energy })}
      </p>
      <EnergyMeter energy={energy} planned={planned} />
      <p className="my-0 text-sm text-muted">{t("dayplan.energy.planned", { planned, energy })}</p>
    </div>
  );
}

/** The planned share of today's Energy. Decoration only: the sentence under it says the same in words. */
function EnergyMeter({ energy, planned }: { energy: number; planned: number }) {
  const used = Math.min(planned, energy);
  if (energy > MAX_SEGMENTS) {
    return (
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-border/30">
        <div className="h-full rounded-pill bg-accent" style={{ width: `${(used / energy) * 100}%` }} />
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex gap-1">
      {Array.from({ length: energy }, (_, point) => (
        <span key={point} className={`h-2 flex-1 rounded-pill ${point < used ? "bg-accent" : "bg-border/30"}`} />
      ))}
    </div>
  );
}
