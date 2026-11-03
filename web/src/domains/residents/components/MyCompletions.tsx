import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { useMyCompletions } from "../hooks/useMyCompletions";
import { ChangeTimeAction } from "./ChangeTimeAction";
import { CompletionDays } from "./CompletionDays";
import { CompletionDaysSkeleton } from "./ResidentPageSkeleton";

/**
 * Me's "My Completions": what the caller completed in the last 30 days, by day, newest first, the same list as
 * the Resident page, plus a "Change time" action on each Completion. It is a section of its own, headed in every state: while the id or the history loads it holds a
 * skeleton (space taken at once, `invisible` until the page says the wait passed 300ms), and a failure is an
 * inline message with Retry. The cards around it never wait on it. An empty history is a calm line, but only once
 * the history really answered; a failed Residents list is a failure, not "no Completions".
 */
export function MyCompletions({ timeZone }: { timeZone: string }) {
  const { t } = useI18n();
  const { state, refreshing, retry } = useMyCompletions();
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);

  return (
    <section aria-labelledby="me-completions-heading" className="flex flex-col gap-4">
      <h3 id="me-completions-heading" className="my-0 text-xl leading-snug font-bold [overflow-wrap:anywhere]">
        {t("me.completions.heading")}
      </h3>
      {state.kind === "loading" && (
        <div aria-hidden="true" data-testid="my-completions-skeleton" className={showSkeleton ? "" : "invisible"}>
          <CompletionDaysSkeleton />
        </div>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 text-danger">
            {t("me.completions.error")}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t("home.retry")}
          </Button>
        </div>
      )}
      {state.kind === "ready" && (
        <CompletionDays
          days={state.detail.days}
          today={state.detail.date}
          timeZone={timeZone}
          empty={t("me.completions.empty")}
          action={(completion) => <ChangeTimeAction completion={completion} today={state.detail.date} timeZone={timeZone} />}
        />
      )}
    </section>
  );
}
