import { CalendarDays, CircleCheck, Flag, Lightbulb, Users } from "lucide-react";
import { Link } from "react-router";
import { CHORES_PATH } from "../../../app/logic/routes";
import { EDIT_PARAM } from "../../chores/components/ChoresSection";
import type { PlanTask } from "../api/api";
import { categoryStyle } from "../../chores/logic/categoryStyle";
import { CategoryTile, EffortDots, Fact, FactIcon, FactList } from "../../chores/components/FactList";
import { Card } from "../../../shared/ui/Card";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { ButtonRow } from "../../../shared/ui/ButtonRow";
import { actionsFor, variantFor, type ActionSlot, type TaskAction, type TaskRole } from "../logic/actions";
import { categoryLabel, importanceLabel, labelText, type Label } from "../../profile/logic/labels";
import { dueWhen, formatDay } from "../logic/format";
import { assignmentReasonLabel, poolReasonLabel } from "../logic/reasons";
import { taskEffortText } from "../logic/taskEffort";

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
  /** This card's own action in flight, which shows the spinner; null when it is another card's or none. */
  pending: TaskAction | null;
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
export function TaskCard({ task, role, today, busy, pending, onAction }: Props) {
  const { t, locale } = useI18n();
  const text = (label: Label) => labelText(t, label);
  const own = role === "mine";
  const { start, end, committed } = actionsFor(task, role);

  // The slot picks the variant, and every action button reserves room for the spinner so the width holds.
  const actionButton = (action: TaskAction, slot: ActionSlot) => (
    <Button
      key={action}
      variant={variantFor(slot)}
      disabled={busy}
      pending={pending === action}
      aria-label={t(ACTION_LABELS[action].named, { task: task.choreName })}
      onClick={() => onAction(action, task)}
    >
      {t(ACTION_LABELS[action].label)}
    </Button>
  );

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

        {task.suggestTwoPerson && task.people !== 2 && role !== "other" && (
          <p className="my-0 flex flex-wrap items-center gap-x-2 text-sm">
            <span>{t("dayplan.task.suggestTwoPerson")}</span>
            <Link
              to={`${CHORES_PATH}?${EDIT_PARAM}=${encodeURIComponent(task.choreId)}`}
              aria-label={t("dayplan.task.suggestTwoPerson.action.named", { task: task.choreName })}
              className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[0.2em]"
            >
              {t("dayplan.task.suggestTwoPerson.action")}
            </Link>
          </p>
        )}

        {(committed || start.length > 0 || end.length > 0) && (
          <ButtonRow
            // An empty slot is undefined, not false, so ButtonRow renders no empty group for it.
            start={
              committed || start.length > 0 ? (
                <>
                  {committed && (
                    <p className="my-0 flex items-center gap-1.5 font-semibold">
                      <CircleCheck aria-hidden="true" size={18} className="shrink-0" />
                      {t("dayplan.task.committed")}
                    </p>
                  )}
                  {start.map((action) => actionButton(action, "start"))}
                </>
              ) : undefined
            }
            end={end.length > 0 ? end.map((action) => actionButton(action, "end")) : undefined}
          />
        )}
      </Card>
    </li>
  );
}

