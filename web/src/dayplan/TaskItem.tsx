import type { PlanTask } from "../api/dayPlan";
import { useI18n } from "../i18n";
import { importanceLabel, type Label } from "../profile/labels";
import { formatDay } from "./format";
import { assignmentReasonLabel, poolReasonLabel } from "./reasons";

interface Props {
  task: PlanTask;
  /** Whether the reason is why the Task was given to someone, or why it is still in the pool. */
  reasonFor: "assigned" | "pool";
}

/** One Task in the Day Plan. Everything is text, so nothing depends on colour. */
export function TaskItem({ task, reasonFor }: Props) {
  const { t, locale } = useI18n();
  const text = (label: Label) => ("key" in label ? t(label.key) : label.text);

  const reason = (reasonFor === "assigned" ? assignmentReasonLabel : poolReasonLabel)(task.reason);
  const facts = [
    task.currentEffort === task.baseEffort
      ? t("dayplan.task.effort", { effort: task.currentEffort })
      : t("dayplan.task.effort.grown", { effort: task.currentEffort, base: task.baseEffort }),
    text(importanceLabel(task.importance)),
    t(task.people === 2 ? "chores.item.people.two" : "chores.item.people.one"),
    t("dayplan.task.due", { date: formatDay(task.windowEnd, locale) }),
  ];

  return (
    <li className="list-none ps-0">
      <h4 className="font-semibold">{task.choreName}</h4>
      <p className="text-muted">{facts.join(" · ")}</p>
      {reason && <p>{t("dayplan.task.reason", { reason: text(reason) })}</p>}
    </li>
  );
}
