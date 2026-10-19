import { Navigate } from "react-router";
import { ME_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import type { ResidentDetail } from "../api/api";
import { useResident } from "../hooks/useResident";
import { dayHeading, dayHeadingText } from "../logic/dayHeading";
import { CompletionCard } from "./CompletionCard";
import { ResidentHeader } from "./ResidentHeader";
import { ResidentPageSkeleton } from "./ResidentPageSkeleton";

function Days({ resident, timeZone }: { resident: ResidentDetail; timeZone: string }) {
  const { t, locale } = useI18n();
  const words = { today: t("resident.day.today"), yesterday: t("resident.day.yesterday") };
  return (
    <section aria-labelledby="resident-recent-heading" className="flex flex-col gap-4">
      <h3 id="resident-recent-heading" className="my-0 text-xl leading-snug font-bold">
        {t("resident.recent.heading")}
      </h3>
      {resident.days.length === 0 ? (
        <p className="my-0 text-muted">{t("resident.empty")}</p>
      ) : (
        resident.days.map((day) => (
          <div key={day.date} className="flex flex-col gap-3">
            <h4 className="my-0 text-base font-bold first-letter:uppercase">
              {dayHeadingText(dayHeading(day.date, resident.date), locale, words)}
            </h4>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {day.completions.map((completion) => (
                <CompletionCard key={completion.id} completion={completion} timeZone={timeZone} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

/**
 * A housemate's page: their name and photo, current Streak, the Tasks done in the last 7 days and their
 * Completions by day, newest day first, with no actions. Your own id goes to Me. Not found is a calm message, not
 * a redirect, so a stale link cannot loop; a failed load is an inline message with Retry. The back link is the
 * route's, outside this component, so it is there in every state.
 */
export function ResidentPage({ id, timeZone }: { id: string; timeZone: string }) {
  const { t } = useI18n();
  const { state, retry } = useResident(id);
  const showSkeleton = useReportFirstLoad(state.kind === "loading");

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
          <Days resident={state.resident} timeZone={timeZone} />
        </div>
      );
  }
}
