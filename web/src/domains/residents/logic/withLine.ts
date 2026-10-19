import type { Translate } from "../../../shared/i18n";
import type { Resident } from "../api/api";

/** The "With X" words on a two-person task, for a housemate: "With you" for the caller, a placeholder while unknown. */
export function withLine(t: Translate, resident: Resident | undefined): string {
  if (resident?.you) return t("dayplan.task.withYou");
  if (!resident) return t("dayplan.task.withSomeone");
  return t("dayplan.task.with", { name: resident.name });
}
