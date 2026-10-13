import { CalendarDays, Flag, Repeat, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { ChoreInput } from "./api";
import { useI18n } from "../shared/i18n";
import { importanceLabel, labelText } from "../profile/labels";
import { effortName } from "./effortLevels";
import { EffortDots, Fact, FactIcon, FactList } from "./FactList";
import { choreWeekdays } from "./facts";
import { intervalText } from "./intervalPresets";

/**
 * A Chore's facts under its name. Importance and people show only when they differ from the usual (Normal, one
 * person), as on Today. The Category is left out: the group heading above the card names it. `children` adds
 * further `Fact`s at the end.
 */
export function ChoreFacts({ chore, children }: { chore: ChoreInput; children?: ReactNode }) {
  const { t, locale } = useI18n();
  const weekdays = choreWeekdays(chore, locale);
  return (
    <FactList>
      <Fact icon={<EffortDots effort={chore.baseEffort} />}>
        {t("chores.item.effort", { level: effortName(t, chore.baseEffort) })}
      </Fact>
      <Fact icon={<FactIcon icon={Repeat} />}>{intervalText(t, chore.intervalDays)}</Fact>
      {weekdays && <Fact icon={<FactIcon icon={CalendarDays} />}>{t("chores.item.weekdays", { days: weekdays })}</Fact>}
      {chore.importance !== "normal" && (
        <Fact icon={<FactIcon icon={Flag} />}>{labelText(t, importanceLabel(chore.importance))}</Fact>
      )}
      {chore.people === 2 && <Fact icon={<FactIcon icon={Users} />}>{t("chores.item.people.two")}</Fact>}
      {chore.buildsUp && <Fact icon={<FactIcon icon={TrendingUp} />}>{t("chores.item.buildsUp")}</Fact>}
      {children}
    </FactList>
  );
}
