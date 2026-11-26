import { List } from "@homeowner/bedrock";
import type { ReactNode } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { ResidentRow } from "./ResidentRow";
import { ResidentRowsSkeleton } from "./ResidentRowSkeleton";
import { ResidentsError } from "./ResidentsError";

/**
 * The first block of the Home tab: a "Moradores · n" label over a Bedrock `List` of the Home's Residents, in the order
 * the API sends them, then the `children` rows (the Invite). While the list loads it holds two skeleton rows: they take
 * their space at once and show after 300ms (hidden, not removed, before that) so nothing jumps either way. A failed
 * list shows an inline message with Retry above the other rows; they and the rest of the tab are unaffected. A Home of
 * one shows just the caller's row, with no nudge.
 */
export function ResidentsCard({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const { state, refreshing, reload } = useShell().residents;
  const showSkeleton = useReportFirstLoad(state.kind === "loading");
  // A refetch over the list already on screen spins the page header's indicator, never the skeleton.
  useReportFetching(refreshing);

  return (
    <section aria-labelledby="home-residents-heading" className="mt-0 flex flex-col gap-2">
      <h2 id="home-residents-heading" className="my-0 text-sm font-medium text-muted">
        {state.kind === "ready" ? t("home.residents.label", { count: state.residents.length }) : t("home.residents.heading")}
      </h2>
      {state.kind === "failed" && <ResidentsError onRetry={reload} />}
      <List>
        {state.kind === "ready" && state.residents.map((resident) => <ResidentRow key={resident.id} resident={resident} />)}
        {state.kind === "loading" && <ResidentRowsSkeleton className={showSkeleton ? "" : "invisible"} />}
        {children}
      </List>
    </section>
  );
}
