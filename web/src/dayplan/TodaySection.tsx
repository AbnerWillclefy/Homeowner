import type { DayPlan } from "../api/dayPlan";
import type { Level } from "../api/checkIn";
import { energyNote } from "../checkin/state";
import { formatAllocationTime } from "../home/allocationTimes";
import { useI18n } from "../i18n";
import { LOAD_FAILURE_KEY } from "./failureMessages";
import { TaskItem } from "./TaskItem";
import { useDayPlan } from "./useDayPlan";

/**
 * Today's Day Plan: your Tasks, other Residents' Tasks and the pool that remains. Read-only: a Day Plan is a
 * proposal, and accepting or refusing it comes later. Rendered inside the Home section, so it only exists
 * while the signed-in User has a Home.
 */
export function TodaySection({ level }: { level: Level | null }) {
  const { t } = useI18n();
  const { state, reload } = useDayPlan();

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
          <PlanView plan={state.plan} level={level} />
        </>
      )}
    </section>
  );
}

function PlanView({ plan, level }: { plan: DayPlan; level: Level | null }) {
  const { t, locale } = useI18n();
  const note = energyNote(plan.energy, level);

  return (
    <>
      {!plan.planned && !plan.rejected && (
        <p role="status">{t("dayplan.notPlanned", { time: formatAllocationTime(plan.allocationTime, locale) })}</p>
      )}
      {plan.rejected && <p role="status">{t("dayplan.rejected")}</p>}

      {plan.planned && (
        <>
          <p>
            {note === "energy" && t("dayplan.energy", { energy: plan.energy ?? 0 })}
            {note === "no-baseline" && t("dayplan.energy.none")}
            {note === "drained" && t("dayplan.energy.drained")}
          </p>

          <h3>{t("dayplan.mine.heading")}</h3>
          {plan.mine.length === 0 ? (
            <p>{t("dayplan.mine.empty")}</p>
          ) : (
            <ul className="p-0">
              {plan.mine.map((task) => (
                <TaskItem key={task.id} task={task} reasonFor="assigned" />
              ))}
            </ul>
          )}

          {plan.others.length > 0 && (
            <>
              <h3>{t("dayplan.others.heading")}</h3>
              {plan.others.map((other, index) => (
                <section key={other.residentId} aria-labelledby={`resident-${index}`}>
                  <h4 id={`resident-${index}`} className="font-semibold">
                    {t("dayplan.others.resident", { number: index + 1 })}
                  </h4>
                  <ul className="p-0">
                    {other.tasks.map((task) => (
                      <TaskItem key={task.id} task={task} reasonFor="assigned" />
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
          <ul className="p-0">
            {plan.pool.map((task) => (
              <TaskItem key={task.id} task={task} reasonFor="pool" />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
