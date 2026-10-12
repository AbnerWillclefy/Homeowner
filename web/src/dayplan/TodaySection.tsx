import { useEffect } from "react";
import { Link } from "react-router";
import type { DayPlan } from "../api/dayPlan";
import type { Level } from "../api/checkIn";
import { ME_PATH } from "../app/routes";
import { energyNote, noTasksReason } from "../checkin/state";
import { formatAllocationTime } from "../home/allocationTimes";
import { useI18n } from "../i18n";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { TaskCard } from "./TaskCard";
import { useDayPlan } from "./useDayPlan";

const LIST = "flex list-none flex-col gap-3 p-0";

/**
 * Today's Day Plan: your Tasks, other Residents' Tasks and the pool that remains. Read-only: a Day Plan is a
 * proposal, and accepting or refusing it comes later. Rendered inside the Home section, so it only exists
 * while the signed-in User has a Home. It reports the plan's Energy upward (null while loading or failed) so
 * the header's chip can show it; the owner remounts it to reload.
 */
export function TodaySection({
  checkIn,
  onEnergy,
}: {
  checkIn: { checkedIn: boolean; level: Level | null } | null;
  onEnergy(energy: number | null): void;
}) {
  const { t } = useI18n();
  const { state, reload } = useDayPlan();
  const energy = state.kind === "ready" ? state.plan.energy : null;

  useEffect(() => {
    onEnergy(energy);
  }, [energy, onEnergy]);

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
            <button type="button" className="btn" onClick={reload}>
              {t("dayplan.retry")}
            </button>
          )}
        </>
      )}

      {state.kind === "ready" && (
        <>
          <p>{t("dayplan.intro")}</p>
          <PlanView plan={state.plan} checkIn={checkIn} />
        </>
      )}
    </section>
  );
}

function PlanView({ plan, checkIn }: { plan: DayPlan; checkIn: { checkedIn: boolean; level: Level | null } | null }) {
  const { t, locale } = useI18n();
  // The chip's note picks the reason for an empty list, so the two can never disagree.
  const reason = noTasksReason(checkIn ? energyNote(plan.energy, checkIn) : "pending");

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
            <>
              {reason === "drained" && <p>{t("dayplan.mine.empty.drained")}</p>}
              {reason === "no-baseline" && (
                <>
                  <p>{t("dayplan.mine.empty.noBaseline")}</p>
                  <p>
                    <Link to={ME_PATH} className="font-semibold text-accent underline">
                      {t("dayplan.mine.empty.noBaseline.link")}
                    </Link>
                  </p>
                </>
              )}
              {reason === "nothing-due" && <p>{t("dayplan.mine.empty")}</p>}
            </>
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
        <>
          <p>{t("dayplan.pool.intro")}</p>
          <ul className={LIST}>
            {plan.pool.map((task) => (
              <TaskCard key={task.id} task={task} reasonFor="pool" />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
