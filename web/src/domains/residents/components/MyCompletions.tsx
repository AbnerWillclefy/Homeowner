import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { useMyCompletions } from "../hooks/useMyCompletions";
import { ChangeTimeAction } from "./ChangeTimeAction";
import { CompletionDays } from "./CompletionDays";
import { CompletionDaysSkeleton } from "./ResidentPageSkeleton";

/**
 * Me's "My Completions": what the caller completed in the last 30 days, by day, newest first, the same list as
 * the Resident page, plus a "Change time" action on each Completion. It is a section of its own: while the id or the history loads it holds a
 * skeleton (space taken at once, `invisible` until the page says the wait passed 300ms), and a failure is an
 * inline message with Retry. The cards around it never wait on it. An empty history is a calm line, but only once
 * the history really answered; a failed Residents list is a failure, not "no Completions".
 */
export function MyCompletions({ timeZone }: { timeZone: string }) {
  const { t } = useI18n();
  const { state, refreshing, retry } = useMyCompletions();
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(refreshing);

  switch (state.kind) {
    case "loading":
      return (
        <div aria-hidden="true" data-testid="my-completions-skeleton" className={showSkeleton ? "" : "invisible"}>
          <CompletionDaysSkeleton />
        </div>
      );
    case "failed":
      return (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 text-danger">
            {t("me.completions.error")}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t("home.retry")}
          </Button>
        </div>
      );
    case "ready":
      return (
        <CompletionDays
          days={state.detail.days}
          today={state.detail.date}
          timeZone={timeZone}
          heading={t("me.completions.heading")}
          empty={t("me.completions.empty")}
          action={(completion) => <ChangeTimeAction completion={completion} today={state.detail.date} timeZone={timeZone} />}
        />
      );
  }
}
