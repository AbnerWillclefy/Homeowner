import type { ChoreInput } from "../api/api";
import { WEEKDAYS } from "../../profile/api/api";
import type { Locale, Translate } from "../../../shared/i18n";
import { categoryLabel, demandLabel, importanceLabel, labelText, type Label } from "../../profile/logic/labels";
import { DISPLAY_WEEKDAYS, weekdayLabel } from "../../profile/logic/weekdays";
import { effortName } from "./effortLevels";
import { intervalText } from "./intervalPresets";

/** The short facts about a Chore, in the order they are listed: Category, then its schedule facts. */
export function choreFacts(chore: ChoreInput, t: Translate, locale: Locale): string[] {
  return [labelText(t, categoryLabel(chore.category)), ...choreScheduleFacts(chore, t, locale)];
}

/** Everything after the Category: Effort, Importance, people, repeat, days, builds-up. */
export function choreScheduleFacts(chore: ChoreInput, t: Translate, locale: Locale): string[] {
  const text = (label: Label) => labelText(t, label);
  const weekdays = choreWeekdays(chore, locale);
  return [
    t("chores.item.effort", { level: effortName(t, chore.baseEffort) }),
    text(importanceLabel(chore.importance)),
    t(chore.people === 2 ? "chores.item.people.two" : "chores.item.people.one"),
    intervalText(t, chore.intervalDays),
    ...(weekdays ? [t("chores.item.weekdays", { days: weekdays })] : []),
    ...(chore.buildsUp ? [t("chores.item.buildsUp")] : []),
  ];
}

/** The weekdays a Chore is limited to, Monday first, as the locale names them; empty when it has no limit. */
export function choreWeekdays(chore: Pick<ChoreInput, "allowedWeekdays">, locale: Locale): string {
  return DISPLAY_WEEKDAYS.filter((day) => chore.allowedWeekdays.includes(WEEKDAYS.indexOf(day)))
    .map((day) => weekdayLabel(day, locale))
    .join(", ");
}

/**
 * The line under a Chore's name in the list: its repeat, its Effort, the Demands it asks for, and who it is reserved
 * for. `responsibleName` is null for Nobody, for a Resident the Home no longer holds, and while the list loads.
 */
export function choreRowMeta(chore: ChoreInput, t: Translate, responsibleName: string | null): string {
  return [
    intervalText(t, chore.intervalDays),
    effortName(t, chore.baseEffort),
    ...chore.demands.map((id) => labelText(t, demandLabel(id))),
    ...(responsibleName ? [t("chores.item.responsible", { name: responsibleName })] : []),
  ].join(" · ");
}
