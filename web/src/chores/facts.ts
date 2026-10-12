import type { ChoreInput } from "./api";
import { WEEKDAYS } from "../profile/api";
import type { Locale, Translate } from "../shared/i18n";
import { categoryLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../profile/weekdays";
import { effortName } from "./effortLevels";
import { intervalText } from "./intervalPresets";

/** The short facts about a Chore, in the order they are listed: Category, then its schedule facts. */
export function choreFacts(chore: ChoreInput, t: Translate, locale: Locale): string[] {
  return [labelText(t, categoryLabel(chore.category)), ...choreScheduleFacts(chore, t, locale)];
}

/** Everything after the Category: Effort, Importance, people, repeat, days, builds-up. */
export function choreScheduleFacts(chore: ChoreInput, t: Translate, locale: Locale): string[] {
  const text = (label: Label) => labelText(t, label);
  const weekdays = DISPLAY_WEEKDAYS.filter((day) => chore.allowedWeekdays.includes(WEEKDAYS.indexOf(day)))
    .map((day) => weekdayLabel(day, locale))
    .join(", ");
  return [
    t("chores.item.effort", { level: effortName(t, chore.baseEffort) }),
    text(importanceLabel(chore.importance)),
    t(chore.people === 2 ? "chores.item.people.two" : "chores.item.people.one"),
    intervalText(t, chore.intervalDays),
    ...(weekdays ? [t("chores.item.weekdays", { days: weekdays })] : []),
    ...(chore.buildsUp ? [t("chores.item.buildsUp")] : []),
  ];
}
