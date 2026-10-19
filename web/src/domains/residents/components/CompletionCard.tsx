import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import { CategoryTile } from "../../chores/components/FactList";
import { categoryStyle } from "../../chores/logic/categoryStyle";
import { formatTime } from "../../dayplan/logic/format";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import type { ResidentCompletion } from "../api/api";

/**
 * One Completion on a Resident's page, as a calm record: the Category tile, the Chore name, then "Category · time"
 * and ", with <name>" for a two-person Completion. The time is in the Home's zone, never the device's. No buttons,
 * no menus and no tint, so nothing here asks for anything.
 */
export function CompletionCard({ completion, timeZone }: { completion: ResidentCompletion; timeZone: string }) {
  const { t, locale } = useI18n();
  const category = labelText(t, categoryLabel(categoryStyle(completion.category).id));
  const time = formatTime(completion.completedAt, locale, timeZone);
  const partners = completion.with.map((partner) => partner.name).join(", ");
  return (
    <li className="my-0 list-none">
      <Card className="flex items-center gap-3">
        <CategoryTile category={completion.category} />
        <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <p className="my-0 text-lg leading-snug font-bold">{completion.choreName}</p>
          <p className="my-0 text-sm font-semibold text-muted">
            {completion.with.length > 0
              ? t("resident.completion.metaWith", { category, time, name: partners })
              : t("resident.completion.meta", { category, time })}
          </p>
        </div>
      </Card>
    </li>
  );
}
