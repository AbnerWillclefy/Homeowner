import { CalendarDays, Flag, ShieldAlert, Users } from "lucide-react";
import { Sheet } from "@homeowner/bedrock";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { CHORES_PATH } from "../../../app/logic/routes";
import { choresQuery } from "../../chores/api/queries";
import { EDIT_PARAM } from "../../chores/components/ChoresSection";
import { EffortDots, Fact, FactIcon, FactList } from "../../chores/components/FactList";
import { choreCategory } from "../../chores/logic/choreCategory";
import { categoryLabel, demandLabel, importanceLabel, labelText } from "../../profile/logic/labels";
import { ResidentLabel } from "../../residents/components/ResidentLabel";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import type { Explanation, PlanTask } from "../api/api";
import type { TaskRole } from "../logic/actions";
import { EXPLANATION_SOURCES } from "../logic/explanationSource";
import { taskEffortText } from "../logic/taskEffort";

// What the Task's state says in the subtitle: yours Proposed or Committed, another Resident's, or still in the pool.
const STATE_KEYS = {
  mine: "dayplan.task.sheet.state.proposed",
  committed: "dayplan.task.sheet.state.committed",
  other: "dayplan.task.sheet.state.other",
  pool: "dayplan.task.sheet.state.pool",
} as const satisfies Record<string, MessageKey>;

/**
 * The whole story of one Task, in a Sheet: why it is here (the full reason, and for your own Tasks the day's
 * explanation), its facts (Effort, when it is due, Importance, Demands, people) and who has it. Mounted only
 * while open, so the Chores are read only when someone looks. Closing returns focus to the card's open button.
 */
export function TaskSheet({
  onClose,
  task,
  role,
  holderId,
  due,
  reason,
  explanation,
}: {
  onClose(): void;
  task: PlanTask;
  role: TaskRole;
  /** The Resident who holds it, on another Resident's card. */
  holderId?: string;
  /** "Para hoje" and the like, worded by the card. */
  due: string;
  /** The one-line why in full; null before the day is planned. */
  reason: string | null;
  explanation?: Explanation;
}) {
  const { t, locale } = useI18n();
  const category = choreCategory(task.category);
  // The Demands live on the Chore, not on the Task. Until the Chores are read the row is left out rather than guessed.
  const chore = useQuery(choresQuery).data?.find((c) => c.id === task.choreId);
  const source = explanation && role === "mine" ? EXPLANATION_SOURCES[explanation.source] : null;

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={task.choreName}
      subtitle={`${labelText(t, categoryLabel(category.id))} · ${t(STATE_KEYS[role === "mine" && task.committed ? "committed" : role])}`}
      closeLabel={t("dayplan.task.sheet.close")}
    >
      <div className="flex flex-col gap-6 pb-4 [overflow-wrap:anywhere]">
        <section className="flex flex-col gap-2">
          <h3 className="my-0 text-base font-bold">{t("dayplan.task.sheet.why")}</h3>
          {reason && <p className="my-0">{reason}</p>}
          {explanation && source && (
            <>
              <p className="my-0 text-muted">{explanation.detail[locale]}</p>
              <p className="my-0 text-sm text-muted">{t(source.labelKey)}</p>
            </>
          )}
        </section>

        <FactList>
          <Fact icon={<EffortDots effort={task.currentEffort} />}>
            {taskEffortText(t, task.currentEffort, task.baseEffort)}
          </Fact>
          <Fact icon={<FactIcon icon={CalendarDays} />}>{due}</Fact>
          <Fact icon={<FactIcon icon={Flag} />}>{labelText(t, importanceLabel(task.importance))}</Fact>
          {chore && (
            <Fact icon={<FactIcon icon={ShieldAlert} />}>
              {chore.demands.length > 0
                ? t("dayplan.task.sheet.demands", { demands: chore.demands.map((id) => labelText(t, demandLabel(id))).join(", ") })
                : t("dayplan.task.sheet.demands.none")}
            </Fact>
          )}
          {task.people === 2 && <Fact icon={<FactIcon icon={Users} />}>{t("chores.item.people.two")}</Fact>}
        </FactList>

        <section className="flex flex-col gap-2">
          <h3 className="my-0 text-base font-bold">{t("dayplan.task.sheet.who")}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 font-semibold">
            <li>
              {role === "other" && holderId ? (
                <ResidentLabel residentId={holderId} />
              ) : (
                t(role === "mine" ? "dayplan.task.sheet.holder.you" : "dayplan.task.sheet.holder.pool")
              )}
            </li>
            {task.with?.map((residentId) => (
              <li key={residentId}>
                <ResidentLabel residentId={residentId} withLine />
              </li>
            ))}
          </ul>
        </section>

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
      </div>
    </Sheet>
  );
}
