import { CalendarDays, Flag, Lightbulb, Users } from "lucide-react";
import type { PlanTask } from "./api";
import { categoryStyle } from "../chores/categoryStyle";
import { CategoryTile, EffortDots, Fact, FactIcon, FactList } from "../chores/FactList";
import { Card } from "../shared/ui/Card";
import { useI18n } from "../shared/i18n";
import { categoryLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { dueWhen, formatDay } from "./format";
import { assignmentReasonLabel, poolReasonLabel } from "./reasons";
import { taskEffortText } from "./taskEffort";

interface Props {
  task: PlanTask;
  /** Whether the reason is why the Task was given to someone, or why it is still in the pool. */
  reasonFor: "assigned" | "pool";
  /** The plan's day, "YYYY-MM-DD", to say whether the Task is due today. */
  today: string;
  /** The Resident's own Tasks fill the card with their Category's pastel; the rest keep it to the icon. */
  own: boolean;
}

/**
 * One Task in the Day Plan: its Category icon and name, the Chore, then its facts (Effort, when it is due,
 * Importance and people when they differ from the usual) and why it is here. The Category name, the Effort and
 * everything else is text, so nothing depends on colour, the icons or the Effort dots. A missing or unknown
 * Category is the neutral "Other" card, never the raw id.
 */
export function TaskCard({ task, reasonFor, today, own }: Props) {
  const { t, locale } = useI18n();
  const text = (label: Label) => labelText(t, label);

  const style = categoryStyle(task.category);
  const reason = (reasonFor === "assigned" ? assignmentReasonLabel : poolReasonLabel)(task.reason);
  const date = formatDay(task.windowEnd, locale);
  const due = {
    past: t("dayplan.task.duePast", { date }),
    today: t("dayplan.task.dueToday"),
    later: t("dayplan.task.due", { date }),
  }[dueWhen(task.windowEnd, today)];

  return (
    <li className="my-0 list-none">
      <Card tint={own ? style : undefined} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <CategoryTile category={task.category} onTint={own} />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <p className="my-0 text-sm font-semibold">{text(categoryLabel(style.id))}</p>
            <h4 className="my-0 text-lg font-bold leading-snug">{task.choreName}</h4>
          </div>
        </div>

        <FactList>
          <Fact icon={<EffortDots effort={task.currentEffort} />}>
            {taskEffortText(t, task.currentEffort, task.baseEffort)}
          </Fact>
          <Fact icon={<FactIcon icon={CalendarDays} />}>{due}</Fact>
          {task.importance !== "normal" && (
            <Fact icon={<FactIcon icon={Flag} />}>{text(importanceLabel(task.importance))}</Fact>
          )}
          {task.people === 2 && <Fact icon={<FactIcon icon={Users} />}>{t("chores.item.people.two")}</Fact>}
        </FactList>

        {reason && (
          <p className="my-0 flex gap-2 border-t border-current/20 pt-3 text-sm">
            <Lightbulb aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            <span>{t("dayplan.task.reason", { reason: text(reason) })}</span>
          </p>
        )}
      </Card>
    </li>
  );
}

