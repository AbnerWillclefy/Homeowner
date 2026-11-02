import { Navigate } from "react-router";
import { ME_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { useResident } from "../hooks/useResident";
import { CompletionDays } from "./CompletionDays";
import { ResidentHeader } from "./ResidentHeader";
import { ResidentPageSkeleton } from "./ResidentPageSkeleton";

/**
 * A housemate's page: their name and photo, current Streak, the Tasks done in the last 30 days and their
 * Completions by day, newest day first, with no actions. Your own id goes to Me. Not found is a calm message, not
 * a redirect, so a stale link cannot loop; a failed load is an inline message with Retry. The back link is the
 * route's, outside this component, so it is there in every state.
 */
export function ResidentPage({ id, timeZone }: { id: string; timeZone: string }) {
  const { t } = useI18n();
  const { state, refreshing, retry } = useResident(id);
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  // A refetch over a page already on screen shows the indicator in the header, never the skeleton.
  useReportFetching(refreshing);

  switch (state.kind) {
    case "loading":
      return <ResidentPageSkeleton className={showSkeleton ? "" : "invisible"} />;
    case "not-found":
      return <p className="my-0">{t("resident.notFound")}</p>;
    case "failed":
      return (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="my-0 text-danger">
            {t(state.reason === "offline" ? "resident.offline" : "resident.error")}
          </p>
          <Button variant="secondary" onClick={retry}>
            {t("home.retry")}
          </Button>
        </div>
      );
    case "ready":
      if (state.resident.you) return <Navigate to={ME_PATH} replace />;
      return (
        <div className="flex flex-col gap-4">
          <ResidentHeader resident={state.resident} />
          <CompletionDays
            days={state.resident.days}
            today={state.resident.date}
            timeZone={timeZone}
            heading={t("resident.recent.heading")}
            empty={t("resident.empty")}
          />
        </div>
      );
  }
}
