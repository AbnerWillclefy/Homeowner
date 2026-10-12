import type { PlanTask } from "./api";
import { CardRow } from "../shared/ui/CardRow";
import { CategoryGlyph } from "../chores/CategoryGlyph";
import { categoryStyle } from "../chores/categoryStyle";
import { useI18n } from "../shared/i18n";
import { categoryLabel, importanceLabel, labelText, type Label } from "../profile/labels";
import { formatDay } from "./format";
import { assignmentReasonLabel, poolReasonLabel } from "./reasons";
import { taskEffortText } from "./taskEffort";

interface Props {
  task: PlanTask;
  /** Whether the reason is why the Task was given to someone, or why it is still in the pool. */
  reasonFor: "assigned" | "pool";
}

/**
 * One Task in the Day Plan, as a card in the pastel of its Chore's Category. The Category name, the Effort and
 * everything else is text, so nothing depends on colour or the icon. A missing or unknown Category is the
 * neutral "Other" card, never the raw id.
 */
export function TaskCard({ task, reasonFor }: Props) {
  const { t, locale } = useI18n();
  const text = (label: Label) => labelText(t, label);

  const { id: category } = categoryStyle(task.category);
  const reason = (reasonFor === "assigned" ? assignmentReasonLabel : poolReasonLabel)(task.reason);
  const effort = taskEffortText(t, task.currentEffort, task.baseEffort);
  const facts = [
    text(importanceLabel(task.importance)),
    t(task.people === 2 ? "chores.item.people.two" : "chores.item.people.one"),
    t("dayplan.task.due", { date: formatDay(task.windowEnd, locale) }),
  ];

  return (
    <li className="list-none ps-0">
      <CardRow category={category} glyph={<CategoryGlyph category={category} />}>
        <div>
          <p className="my-0 text-sm font-semibold">{text(categoryLabel(category))}</p>
          <h4 className="my-1 text-lg font-bold leading-snug">{task.choreName}</h4>
          <p className="my-1 font-semibold">{effort}</p>
          <p className="my-1">{facts.join(" · ")}</p>
          {reason && <p className="my-1">{t("dayplan.task.reason", { reason: text(reason) })}</p>}
        </div>
      </CardRow>
    </li>
  );
}
