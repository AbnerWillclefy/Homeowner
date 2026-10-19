import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ResidentRow } from "./ResidentRow";
import { ResidentRowSkeleton } from "./ResidentRowSkeleton";

/** Two placeholder rows keep the card the height of the common two-person Home. */
const PLACEHOLDER_ROWS = [0, 1];

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
      {state.kind === "loading" && (
        <ul aria-hidden="true" className={`m-0 list-none p-0 ${showSkeleton ? "" : "invisible"}`}>
          {PLACEHOLDER_ROWS.map((row) => (
            <ResidentRowSkeleton key={row} />
          ))}
        </ul>
      )}
      {state.kind === "failed" && (
        <div className="flex flex-col items-start gap-3 py-3">
          <p role="alert" className="my-0 text-danger">
            {t("home.residents.error")}
          </p>
          <Button variant="secondary" onClick={reload}>
            {t("home.retry")}
          </Button>
        </div>
      )}
    </Card>
  );
}
