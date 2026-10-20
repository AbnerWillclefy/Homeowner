import { CircleCheck } from "lucide-react";
import type { CompletedTask } from "../api/api";
import { categoryStyle } from "../../chores/logic/categoryStyle";
import { CategoryTile } from "../../chores/components/FactList";
import { categoryLabel, labelText } from "../../profile/logic/labels";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import { formatTime } from "../logic/format";

/**
 * One Task the Resident finished today, as a calm record: the Category tile and name, the Chore, and when it
 * was done. No facts, no Effort and no buttons, and never tinted with the Category's pastel, so it reads
 * quieter than the Task cards. A two-person Task says it was done together; when Resident names exist, only
 * that string and its argument change.
 */
export function DoneCard({ done }: { done: CompletedTask }) {
  const { t, locale } = useI18n();
  const style = categoryStyle(done.category);
  const time = formatTime(done.completedAt, locale);

  return (
    <li className="my-0 list-none">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CategoryTile category={done.category} />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <p className="my-0 text-sm font-semibold">{labelText(t, categoryLabel(style.id))}</p>
            <h4 className="my-0 text-lg font-bold leading-snug">{done.choreName}</h4>
          </div>
        </div>
        <p className="my-0 flex gap-1.5 text-sm text-muted">
          <CircleCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          <span className="[overflow-wrap:anywhere]">
            {t(done.with.length > 0 ? "dayplan.done.atTogether" : "dayplan.done.at", { time })}
          </span>
        </p>
      </Card>
    </li>
  );
}
