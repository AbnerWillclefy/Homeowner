import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { Card } from "../../../shared/ui/Card";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ResidentRow } from "./ResidentRow";
import { ResidentRowsSkeleton } from "./ResidentRowSkeleton";
import { ResidentsError } from "./ResidentsError";

/**
 * The first card of the Home tab: the Home's Residents, in the order the API sends them. It reads the Shell's
 * shared list. While that loads the card holds two skeleton rows: they take their space at once and show after 300ms
 * (hidden, not removed, before that) so nothing jumps either way. A failed list shows an inline message with Retry
 * inside the card; the rest of the tab is unaffected. A Home of one shows just the caller's row, with no nudge.
 */
export function ResidentsCard() {
  const { t } = useI18n();
  const { state, reload } = useShell().residents;
  const showSkeleton = useReportFirstLoad(state.kind === "loading");

  return (
    <Card as="section" aria-labelledby="home-residents-heading" className="mt-0 py-1">
      <h3 id="home-residents-heading" className="sr-only">
        {t("home.residents.heading")}
      </h3>
      {state.kind === "ready" && (
        <ul className="m-0 list-none p-0">
          {state.residents.map((resident) => (
            <ResidentRow key={resident.id} resident={resident} />
          ))}
        </ul>
      )}
      {state.kind === "loading" && <ResidentRowsSkeleton className={showSkeleton ? "" : "invisible"} />}
      {state.kind === "failed" && <ResidentsError onRetry={reload} />}
    </Card>
  );
}
