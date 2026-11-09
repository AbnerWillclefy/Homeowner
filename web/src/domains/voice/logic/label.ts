import type { Locale, MessageKey, Translate } from "../../../shared/i18n";
import { choreWeekdays } from "../../chores/logic/facts";
import { effortName } from "../../chores/logic/effortLevels";
import { intervalText } from "../../chores/logic/intervalPresets";
import { categoryLabel, importanceLabel, labelText } from "../../profile/logic/labels";
import type { ChangedField, VoiceAction } from "../api/api";
import type { ChoreWire } from "../../chores/api/api";

const days = (body: ChoreWire, t: Translate, locale: Locale) => choreWeekdays(body, locale) || t("voice.days.any");
const interval = (body: ChoreWire, t: Translate) => intervalText(t, typeof body.intervalDays === "number" ? body.intervalDays : null);

/** The new value of one changed field, from the proposed Chore. */
function value(field: ChangedField, body: ChoreWire, t: Translate, locale: Locale): string {
  switch (field) {
    case "name":
      return body.name;
    case "category":
      return labelText(t, categoryLabel(body.category));
    case "baseEffort":
      return effortName(t, body.baseEffort);
    case "importance":
      return labelText(t, importanceLabel(body.importance));
    case "intervalDays":
      return interval(body, t);
    case "allowedWeekdays":
      return days(body, t, locale);
  }
}

/**
 * The words for an action, from the app's own text plus the Chore's name. The only text from the server that
 * appears is that name (a proposed one for a create); the model's own words never do.
 */
export function actionLabel(action: VoiceAction, t: Translate, locale: Locale): string {
  switch (action.kind) {
    case "create_chore": {
      const weekdays = choreWeekdays(action.body, locale);
      const schedule = [interval(action.body, t), ...(weekdays ? [t("chores.item.weekdays", { days: weekdays })] : [])].join(", ");
      return t("voice.action.create", { name: action.choreName, schedule });
    }
    case "edit_chore": {
      const changes = action.changed
        .map((field) => t("voice.change", { field: t(`voice.field.${field}` satisfies MessageKey), value: value(field, action.body, t, locale) }))
        .join(", ");
      return t("voice.action.edit", { name: action.choreName, changes });
    }
    case "choice":
      return t("voice.action.choice");
    default:
      return t(`voice.action.${action.kind}`, { name: action.choreName });
  }
}
