import { CalendarDays, CircleCheck, Flag, Lightbulb, Users } from "lucide-react";
import type { PlanTask } from "./api";
import { categoryStyle } from "../chores/categoryStyle";
import { CategoryTile, EffortDots, Fact, FactIcon, FactList } from "../chores/FactList";
import { Card } from "../shared/ui/Card";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { actionsFor, type TaskAction, type TaskRole } from "./actions";
import { categoryLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { dueWhen, formatDay } from "./format";
import { assignmentReasonLabel, poolReasonLabel } from "./reasons";
import { taskEffortText } from "./taskEffort";

interface Props {
  task: PlanTask;
  /**
   * Where the Task sits: yours, another Resident's or the pool. It decides whether the reason says why it was
   * given to someone or why it is still in the pool, which actions it has, and whether the card is filled with
   * its Category's pastel (only your own are; the rest keep the colour to the icon).
   */
  role: TaskRole;
  /** The plan's day, "YYYY-MM-DD", to say whether the Task is due today. */
  today: string;
  /** An action is running somewhere in the plan, so every button is disabled. */
  busy: boolean;
  onAction(action: TaskAction, task: PlanTask): void;
}

// Each action's visible label and its accessible name, which says which Task and starts with the visible
// label so voice control ("tap Accept") finds it.
const ACTION_LABELS: Record<TaskAction, { label: MessageKey; named: MessageKey }> = {
  accept: { label: "dayplan.action.accept", named: "dayplan.action.accept.named" },
  refuse: { label: "dayplan.action.refuse", named: "dayplan.action.refuse.named" },
  take: { label: "dayplan.action.take", named: "dayplan.action.take.named" },
  done: { label: "dayplan.action.done", named: "dayplan.action.done.named" },
};

/**
 * One Task in the Day Plan: its Category icon and name, the Chore, then its facts (Effort, when it is due,
 * Importance and people when they differ from the usual) and why it is here. The Category name, the Effort and
 * everything else is text, so nothing depends on colour, the icons or the Effort dots. A missing or unknown
 * Category is the neutral "Other" card, never the raw id.
 */
export function TaskCard({ task, role, today, busy, onAction }: Props) {
  const { t, locale } = useI18n();
  const text = (label: Label) => labelText(t, label);
  const own = role === "mine";
  const { actions, committed } = actionsFor(task, role);

  const style = categoryStyle(task.category);
  const reason = (role === "pool" ? poolReasonLabel : assignmentReasonLabel)(task.reason);
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

        {(committed || actions.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {committed && (
              <p className="my-0 flex items-center gap-1.5 font-semibold">
                <CircleCheck aria-hidden="true" size={18} className="shrink-0" />
                {t("dayplan.task.committed")}
              </p>
            )}
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === "accept" || action === "take" ? "primary" : "secondary"}
                disabled={busy}
                aria-label={t(ACTION_LABELS[action].named, { task: task.choreName })}
                onClick={() => onAction(action, task)}
              >
                {t(ACTION_LABELS[action].label)}
              </Button>
            ))}
          </div>
        )}
      </Card>
    </li>
  );
}

