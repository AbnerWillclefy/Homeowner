import { Clock } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Link } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import type { DayPlan, PlanTask } from "../api/api";
import { pendingAction, type Acting, type SwapAction, type TaskAction, type TaskRole } from "../logic/actions";
import { ME_PATH } from "../../../app/logic/routes";
import { noTasksReason, type EnergyNote, type NoTasksReason } from "../../checkin/logic/state";
import { formatAllocationTime } from "../../home/logic/allocationTimes";
import { SectionHeading } from "@homeowner/bedrock";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { sectionTitle } from "../../../shared/i18n/sectionTitle";
import { Button } from "../../../shared/ui/Button";
import { LOAD_FAILURE_KEY } from "../logic/failureMessages";
import { ResidentLabel } from "../../residents/components/ResidentLabel";
import { DaySummary } from "./DaySummary";
import { ChangeTimeAction } from "../../residents/components/ChangeTimeAction";
import { DoneCard } from "./DoneCard";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { DayPlanSkeleton } from "./DayPlanSkeleton";
import { proposedCount, showAcceptAll } from "../logic/summaryCounts";
import { canOfferFor, requestableTasks } from "../logic/swaps";
import { OfferGroup } from "./SwapOffers";
import { SwapSheet } from "./SwapSheet";
import { TaskCard } from "./TaskCard";
import type { ActionNotice, useDayPlan } from "../hooks/useDayPlan";

const LIST = "m-0 flex list-none flex-col gap-3 p-0";

type Day = ReturnType<typeof useDayPlan>;
/** Your own Task being offered; `opener` is the card's open button, where focus returns when the Sheet closes. */
type SwapOffering = { task: PlanTask; opener: HTMLElement | null };

/**
 * Today's Day Plan: your Tasks, other Residents' Tasks and the pool that remains, and what you did today. A Day
 * Plan is a proposal: you accept, refuse, take or complete Tasks, and the plan only changes from the server's
 * answer. Rendered inside the Home section, so it only exists while the signed-in User has a Home. The owner
 * loads the plan; `note` is the Shell's Energy note, which only decides why an empty list is empty, and is
 * null while the Check-in is not known.
 */
export function TodaySection({
  day,
  note,
  headingId,
  headingRef,
}: {
  day: Day;
  note: EnergyNote | null;
  /** The id of the page's header title, which names this section. */
  headingId: string;
  /** The header title's element: where focus returns after the plan changed. */
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useI18n();
  const { state, reload, run, acceptAll, answerSwap, offerSwap, acting, notice, changed } = day;
  // The page's one status announces the wait; the skeleton shows after 300ms and only for a first load.
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  const section = useRef<HTMLElement>(null);
  const heading = headingRef;
  // The Task a Swap is being offered for, known at the tap. One Sheet for the whole plan, mounted only after a tap
  // on "Oferecer troca" in a Task's Sheet.
  const [offer, setOffer] = useState<SwapOffering | null>(null);

  // A Task that leaves its list takes its button with it, so focus would fall to <body>. Bring it back to the
  // section's heading, unless focus is still on something inside the section. `preventScroll`: the heading is at
  // the top of the section, and a plain focus() would scroll the page up to it.
  // It waits for the Swap Sheet to be gone (its focus trap owns focus while open): closing it re-runs this
  // effect, after the Sheet has unmounted. Where the card is still there, the Sheet's own return of focus
  // to its open button runs after this and wins.
  useEffect(() => {
    if (changed === 0 || offer !== null) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === section.current || !section.current?.contains(active)) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [changed, offer]);

  return (
    <section ref={section} aria-labelledby={headingId} className="mt-0">
      <Notice notice={notice} />

      {showSkeleton && <DayPlanSkeleton />}
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
          refreshing={day.refreshing}
          note={note}
          acting={acting}
          onAccept={acceptAll}
          onAction={run}
          onAnswer={answerSwap}
          onOffer={offerSwap}
          offer={offer}
          onOfferChange={setOffer}
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
  refreshing,
  note,
  acting,
  onAccept,
  onAction,
  onAnswer,
  onOffer,
  offer,
  onOfferChange,
}: {
  plan: DayPlan;
  /** The Day Plan is being read again behind what is on screen. */
  refreshing: boolean;
  note: EnergyNote | null;
  acting: Acting;
  onAccept(): void;
  onAction(action: TaskAction, task: PlanTask): void;
  onAnswer(action: SwapAction, swapId: string): void;
  onOffer(offeredTaskId: string, requestedTaskId: string): Promise<void>;
  offer: SwapOffering | null;
  onOfferChange(offer: SwapOffering | null): void;
}) {
  const { t, locale } = useI18n();
  // The chip's note picks the reason for an empty list, so the two can never disagree.
  const reason = note && noTasksReason(note);
  // Every button waits while anything runs; only the pressed one shows its spinner.
  const busy = acting !== null;
  const proposed = proposedCount(plan);
  // Change time needs the Home's zone for its bounds; without it the Done cards stay plain records.
  const { home } = useShell();
  const timeZone = home.state.kind === "ready" ? home.state.home.timezone : null;
  // The Done card just moved: it stays, dimmed and busy, until the Day Plan read behind it answers.
  const [movedId, setMovedId] = useState<string | null>(null);
  useEffect(() => {
    if (!refreshing) setMovedId(null);
  }, [refreshing]);
  const card = (task: PlanTask, role: TaskRole) => (
    <TaskCard
      key={task.id}
      task={task}
      role={role}
      today={plan.date}
      explanation={plan.explanation}
      busy={busy}
      pending={pendingAction(acting, task.id)}
      onAction={onAction}
      onSwap={
        role === "mine" && canOfferFor(plan, task) ? (_task, opener) => onOfferChange({ task, opener }) : undefined
      }
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {plan.planned && <DaySummary plan={plan} />}
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

      <OfferGroup
        offers={plan.planned ? plan.swaps.incoming : []}
        direction="incoming"
        acting={acting}
        onAnswer={onAnswer}
      />

      {plan.planned && (
        <div className="flex flex-col gap-3">
          <SectionHeading
            variant="title"
            title={t("dayplan.mine.heading")}
            end={
              showAcceptAll(plan) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  pending={acting?.action === "acceptAll"}
                  onClick={onAccept}
                >
                  {t("dayplan.action.acceptAll", { count: proposed })}
                </Button>
              )
            }
          />
          {plan.mine.length > 0 ? (
            <ul className={LIST}>{plan.mine.map((task) => card(task, "mine"))}</ul>
          ) : (
            <EmptyMine reason={reason} />
          )}
        </div>
      )}

      {plan.doneToday.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading variant="label" title={sectionTitle(t, t("dayplan.done.heading"), plan.doneToday.length)} />
          <ul className={LIST}>
            {plan.doneToday.map((done) => (
              <DoneCard
                key={done.id}
                done={done}
                action={
                  timeZone !== null && done.completionId !== undefined ? (
                    <ChangeTimeAction
                      completion={{ id: done.completionId, choreName: done.choreName, completedAt: done.completedAt }}
                      today={plan.date}
                      timeZone={timeZone}
                      onMoved={() => setMovedId(done.id)}
                    />
                  ) : undefined
                }
                busy={refreshing && movedId === done.id}
              />
            ))}
          </ul>
        </div>
      )}

      <OfferGroup
        offers={plan.planned ? plan.swaps.outgoing : []}
        direction="outgoing"
        acting={acting}
        onAnswer={onAnswer}
      />

      {plan.planned && plan.others.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeading variant="title" title={t("dayplan.others.heading")} />
          <div className="flex flex-col gap-4">
            {plan.others.map((other, index) => (
              <section key={other.residentId} aria-labelledby={`resident-${index}`} className="mt-0">
                <h4 id={`resident-${index}`} className="mt-0 mb-2 text-base font-bold">
                  <ResidentLabel residentId={other.residentId} />
                </h4>
                <ul className={LIST}>
                  {other.tasks.map((task) => card(task, "other"))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <SectionHeading variant="title" title={sectionTitle(t, t("dayplan.pool.heading"), plan.pool.length)} />
        {plan.pool.length === 0 ? (
          <p className="my-0 text-muted">{t("dayplan.pool.empty")}</p>
        ) : (
          <ul className={LIST}>
            {plan.pool.map((task) => card(task, "pool"))}
          </ul>
        )}
      </div>

      {offer && (
        <SwapSheet
          offered={offer.task}
          options={requestableTasks(plan)}
          offer={onOffer}
          returnFocusRef={{ current: offer.opener }}
          onClose={() => onOfferChange(null)}
        />
      )}
    </div>
  );
}

