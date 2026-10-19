import { Clock, UserRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import type { DayPlan, PlanTask } from "../api/api";
import { pendingAction, type Acting, type TaskAction, type TaskRole } from "../logic/actions";
import { ME_PATH } from "../../../app/logic/routes";
import { noTasksReason, type EnergyNote, type NoTasksReason } from "../../checkin/logic/state";
import { formatAllocationTime } from "../../home/logic/allocationTimes";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { GroupHeading } from "../../../shared/ui/GroupHeading";
import { LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { DoneCard } from "./DoneCard";
import { TaskCard } from "./TaskCard";
import type { ActionNotice, useDayPlan } from "../hooks/useDayPlan";

const LIST = "m-0 flex list-none flex-col gap-3 p-0";

type Day = ReturnType<typeof useDayPlan>;

/**
 * Today's Day Plan: your Tasks, other Residents' Tasks and the pool that remains, and what you did today. A Day
 * Plan is a proposal: you accept, refuse, take or complete Tasks, and the plan only changes from the server's
 * answer. Rendered inside the Home section, so it only exists while the signed-in User has a Home. The owner
 * loads the plan and shows its Energy in the header's chip; `note` is that chip's note, null while the
 * Check-in is not known.
 */
export function TodaySection({ day, note }: { day: Day; note: EnergyNote | null }) {
  const { t } = useI18n();
  const { state, reload, run, acceptAll, acting, notice, settled } = day;
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // A Task that leaves its list takes its button with it, so focus would fall to <body>. Bring it back to the
  // section's heading when the plan changed, unless focus is still on something inside the section.
  useEffect(() => {
    if (settled === 0) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === section.current || !section.current?.contains(active)) {
      heading.current?.focus();
    }
  }, [settled]);

  return (
    <section ref={section} aria-labelledby="today-heading">
      {/* The greeting is the visible title; this one names the landmark for screen readers. */}
      <h2 id="today-heading" ref={heading} tabIndex={-1} className="sr-only">
        {t("dayplan.heading")}
      </h2>

      <Notice notice={notice} />

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

      {state.kind === "ready" && (
        <PlanView
          plan={state.plan}
          note={note}
          acting={acting}
          onAccept={acceptAll}
          onAction={run}
        />
      )}
    </section>
  );
}

/**
 * What the last action said. The two live regions are always in the page, so text arriving in them is
 * announced: a status for a stale screen that was refreshed, an alert when something failed.
 */
function Notice({ notice }: { notice: ActionNotice | null }) {
  const { t } = useI18n();
  const lines = (tone: ActionNotice["tone"], className: string) =>
    notice?.tone === tone &&
    notice.keys.map((key) => (
      <p key={key} className={`mt-0 mb-3 font-semibold ${className}`}>
        {t(key)}
      </p>
    ));
  return (
    <>
      <div role="status">{lines("status", "")}</div>
      <div role="alert">{lines("alert", "text-danger")}</div>
    </>
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

function PlanView({
  plan,
  note,
  acting,
  onAccept,
  onAction,
}: {
  plan: DayPlan;
  note: EnergyNote | null;
  acting: Acting;
  onAccept(): void;
  onAction(action: TaskAction, task: PlanTask): void;
}) {
  const { t, locale } = useI18n();
  // The chip's note picks the reason for an empty list, so the two can never disagree.
  const reason = note && noTasksReason(note);
  // Every button waits while anything runs; only the pressed one shows its spinner.
  const busy = acting !== null;
  const proposed = plan.mine.filter((task) => !task.committed).length;
  const card = (task: PlanTask, role: TaskRole) => (
    <TaskCard
      key={task.id}
      task={task}
      role={role}
      today={plan.date}
      busy={busy}
      pending={pendingAction(acting, task.id)}
      onAction={onAction}
    />
  );

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
          {proposed > 0 && (
            <Button
              fullWidth
              className="mb-3"
              disabled={busy}
              pending={acting?.action === "acceptAll"}
              onClick={onAccept}
            >
              {t("dayplan.action.acceptAll", { count: proposed })}
            </Button>
          )}
          {plan.mine.length > 0 ? (
            <ul className={LIST}>{plan.mine.map((task) => card(task, "mine"))}</ul>
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
                  {other.tasks.map((task) => card(task, "other"))}
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
            {plan.pool.map((task) => card(task, "pool"))}
          </ul>
        )}
      </div>

      {plan.doneToday.length > 0 && (
        <div>
          <GroupHeading count={plan.doneToday.length}>{t("dayplan.done.heading")}</GroupHeading>
          <ul className={LIST}>
            {plan.doneToday.map((done) => (
              <DoneCard key={done.id} done={done} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

