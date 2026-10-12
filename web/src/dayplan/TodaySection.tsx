import { Clock, UserRound } from "lucide-react";
import { Link } from "react-router";
import type { DayPlan } from "./api";
import { ME_PATH } from "../app/routes";
import { noTasksReason, type EnergyNote, type NoTasksReason } from "../checkin/state";
import { formatAllocationTime } from "../home/allocationTimes";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { GroupHeading } from "../shared/ui/GroupHeading";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { TaskCard } from "./TaskCard";
import type { DayPlanState } from "./useDayPlan";

const LIST = "m-0 flex list-none flex-col gap-3 p-0";

/**
 * Today's Day Plan: your Tasks, other Residents' Tasks and the pool that remains. Read-only: a Day Plan is a
 * proposal, and accepting or refusing it comes later. Rendered inside the Home section, so it only exists
 * while the signed-in User has a Home. The owner loads the plan and shows its Energy in the header's chip;
 * `note` is that chip's note, null while the Check-in is not known.
 */
export function TodaySection({
  state,
  reload,
  note,
}: {
  state: DayPlanState;
  reload(): void;
  note: EnergyNote | null;
}) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="today-heading">
      {/* The greeting is the visible title; this one names the landmark for screen readers. */}
      <h2 id="today-heading" className="sr-only">
        {t("dayplan.heading")}
      </h2>

      {state.kind === "loading" && <p role="status">{t("dayplan.loading")}</p>}

      {state.kind === "failed" && (
        <>
          <p role="alert" className="text-danger">
            {t(LOAD_FAILURE_KEY[state.reason])}
          </p>
          {state.reason !== "not-signed-in" && (
            <Button variant="secondary" onClick={reload}>
              {t("dayplan.retry")}
            </Button>
          )}
        </>
      )}

      {state.kind === "ready" && <PlanView plan={state.plan} note={note} />}
    </section>
  );
}

const EMPTY_MINE = {
  drained: "dayplan.mine.empty.drained",
  "no-baseline": "dayplan.mine.empty.noBaseline",
  "nothing-due": "dayplan.mine.empty",
} as const satisfies Record<NoTasksReason, MessageKey>;

/** Why the Resident has no Tasks today; without a Baseline it also points to where to set one. */
function EmptyMine({ reason }: { reason: NoTasksReason | null }) {
  const { t } = useI18n();
  // Without a known Check-in the reason is unknown, so say nothing rather than guess.
  if (!reason) return null;
  return (
    <>
      <p className="my-0 text-muted">{t(EMPTY_MINE[reason])}</p>
      {reason === "no-baseline" && (
        <p className="mt-1 mb-0">
          <Link to={ME_PATH} className="font-semibold text-accent underline">
            {t("dayplan.mine.empty.noBaseline.link")}
          </Link>
        </p>
      )}
    </>
  );
}

function PlanView({ plan, note }: { plan: DayPlan; note: EnergyNote | null }) {
  const { t, locale } = useI18n();
  // The chip's note picks the reason for an empty list, so the two can never disagree.
  const reason = note && noTasksReason(note);

  return (
    <div className="flex flex-col gap-8">
      {!plan.planned && !plan.rejected && (
        <p role="status" className="my-0 flex items-center gap-2 font-semibold text-muted">
          <Clock aria-hidden="true" size={18} className="shrink-0" />
          {t("dayplan.notPlanned", { time: formatAllocationTime(plan.allocationTime, locale) })}
        </p>
      )}
      {plan.rejected && (
        <p role="status" className="my-0 text-muted">
          {t("dayplan.rejected")}
        </p>
      )}

      {plan.planned && (
        <div>
          <GroupHeading count={plan.mine.length}>{t("dayplan.mine.heading")}</GroupHeading>
          {plan.mine.length > 0 ? (
            <ul className={LIST}>
              {plan.mine.map((task) => (
                <TaskCard key={task.id} task={task} reasonFor="assigned" today={plan.date} own />
              ))}
            </ul>
          ) : (
            <EmptyMine reason={reason} />
          )}
        </div>
      )}

      {plan.planned && plan.others.length > 0 && (
        <div>
          <GroupHeading>{t("dayplan.others.heading")}</GroupHeading>
          <div className="flex flex-col gap-5">
            {plan.others.map((other, index) => (
              <section key={other.residentId} aria-labelledby={`resident-${index}`} className="mt-0">
                <h4 id={`resident-${index}`} className="mt-0 mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
                  <UserRound aria-hidden="true" size={16} className="shrink-0" />
                  {t("dayplan.others.resident", { number: index + 1 })}
                </h4>
                <ul className={LIST}>
                  {other.tasks.map((task) => (
                    <TaskCard key={task.id} task={task} reasonFor="assigned" today={plan.date} own={false} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      <div>
        <GroupHeading count={plan.pool.length}>{t("dayplan.pool.heading")}</GroupHeading>
        {plan.pool.length === 0 ? (
          <p className="my-0 text-muted">{t("dayplan.pool.empty")}</p>
        ) : (
          <ul className={LIST}>
            {plan.pool.map((task) => (
              <TaskCard key={task.id} task={task} reasonFor="pool" today={plan.date} own={false} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

