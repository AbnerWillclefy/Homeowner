import type { ChoreInput } from "../api/chores";
import { WEEKDAYS } from "../api/profile";
import type { Locale, Translate } from "../i18n";
import { categoryLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../profile/weekdays";

/** The short facts about a Chore, in the order they are listed: Category, Effort, Importance, people, repeat, days. */
export function choreFacts(chore: ChoreInput, t: Translate, locale: Locale): string[] {
  const text = (label: Label) => labelText(t, label);
  const weekdays = DISPLAY_WEEKDAYS.filter((day) => chore.allowedWeekdays.includes(WEEKDAYS.indexOf(day)))
    .map((day) => weekdayLabel(day, locale))
    .join(", ");
  const repeat =
    chore.intervalDays === null
      ? t("chores.item.once")
      : chore.intervalDays === 1
        ? t("chores.item.daily")
        : t("chores.item.every", { days: chore.intervalDays });
  return [
    text(categoryLabel(chore.category)),
    t("chores.item.effort", { effort: chore.baseEffort }),
    text(importanceLabel(chore.importance)),
    t(chore.people === 2 ? "chores.item.people.two" : "chores.item.people.one"),
    repeat,
    ...(weekdays ? [t("chores.item.weekdays", { days: weekdays })] : []),
    ...(chore.buildsUp ? [t("chores.item.buildsUp")] : []),
  ];
}
