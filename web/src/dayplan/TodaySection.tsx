import { Link } from "react-router";
import type { DayPlan } from "./api";
import { ME_PATH } from "../app/routes";
import { noTasksReason, type EnergyNote, type NoTasksReason } from "../checkin/state";
import { formatAllocationTime } from "../home/allocationTimes";
import { useI18n, type MessageKey } from "../shared/i18n";
import { Button } from "../shared/ui/Button";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { TaskCard } from "./TaskCard";
import type { DayPlanState } from "./useDayPlan";

const LIST = "flex list-none flex-col gap-3 p-0";

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
      <h2 id="today-heading">{t("dayplan.heading")}</h2>

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
      <p>{t(EMPTY_MINE[reason])}</p>
      {reason === "no-baseline" && (
        <p>
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
    <>
      {!plan.planned && !plan.rejected && (
        <p role="status">{t("dayplan.notPlanned", { time: formatAllocationTime(plan.allocationTime, locale) })}</p>
      )}
      {plan.rejected && <p role="status">{t("dayplan.rejected")}</p>}

      {plan.planned && (
        <>
          <h3>{t("dayplan.mine.heading")}</h3>
          {plan.mine.length > 0 ? (
            <ul className={LIST}>
              {plan.mine.map((task) => (
                <TaskCard key={task.id} task={task} reasonFor="assigned" />
              ))}
            </ul>
          ) : (
            <EmptyMine reason={reason} />
          )}

          {plan.others.length > 0 && (
            <>
              <h3>{t("dayplan.others.heading")}</h3>
              {plan.others.map((other, index) => (
                <section key={other.residentId} aria-labelledby={`resident-${index}`}>
                  <h4 id={`resident-${index}`} className="font-semibold">
                    {t("dayplan.others.resident", { number: index + 1 })}
                  </h4>
                  <ul className={LIST}>
                    {other.tasks.map((task) => (
                      <TaskCard key={task.id} task={task} reasonFor="assigned" />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </>
      )}

      <h3>{t("dayplan.pool.heading")}</h3>
      {plan.pool.length === 0 ? (
        <p>{t("dayplan.pool.empty")}</p>
      ) : (
        <ul className={LIST}>
          {plan.pool.map((task) => (
            <TaskCard key={task.id} task={task} reasonFor="pool" />
          ))}
        </ul>
      )}
    </>
  );
}
