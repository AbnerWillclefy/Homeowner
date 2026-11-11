import { SlidersHorizontal } from "lucide-react";
import { Link } from "react-router";
import { FINANCES_SETTINGS_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { useFinance } from "../hooks/useFinance";
import { useFinanceMonth } from "../hooks/useFinanceMonth";
import { BillsSection } from "./BillsSection";
import { Commitments } from "./Commitments";
import { FinanceNav, type FinanceView } from "./FinanceNav";
import { FinanceSetup, FinanceStatusGate } from "./FinanceSetup";
import { SavingsCards } from "./FinanceSavings";
import { MonthPicker } from "./MonthPicker";
import { Spending } from "./Spending";
import { Summary } from "./Summary";

/** Finances: private to the User, with no link to Residents, Chores, Tasks or Allocation. One route per view. */
export function FinancesTab({ view }: { view: FinanceView }) {
  const { t } = useI18n();
  const finance = useFinance();
  const { month } = useFinanceMonth();
  // Ajustes only once there are Sources: before that the setup flow is the whole page.
  const hasSources = finance.state.kind === "ready" && finance.state.data.sources.length > 0;
  return (
    <PageLoading message={t("finances.loading")}>
      <PageHeader
        title={t("finances.title")}
        aside={
          hasSources && (
            <Button asChild icon variant="secondary">
              <Link to={FINANCES_SETTINGS_PATH} aria-label={t("finances.settings.open")}>
                <SlidersHorizontal aria-hidden="true" size={20} />
              </Link>
            </Button>
          )
        }
      />
      <FinanceStatusGate finance={finance}>
        {(status) => (
          <FinanceSetup finance={finance} status={status}>
            {({ sources, credentials, deletion }) =>
              // Before the first Source there is nothing to read yet: the setup flow stays one short column.
              status.sources.length === 0 ? (
                <div className="flex flex-col gap-4">
                  <BillsSection picker />
                  {credentials}
                  {sources}
                  {deletion}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <FinanceNav />
                  {/* Economias is not monthly, so it has no month to pick. */}
                  {view !== "savings" && <MonthPicker groupLabel={t("finances.month.heading")} />}
                  {status.importing && <p className="my-0 text-muted">{t("finances.importing")}</p>}
                  {view === "summary" && <Summary lastSyncedAt={status.lastSyncedAt} />}
                  {/* Keyed by month, so a switch starts clean: no open dialog or note from the month before. */}
                  {view === "spending" && <Spending key={month} />}
                  {view === "bills" && <BillsSection key={month} current={<Commitments />} />}
                  {view === "savings" && <SavingsCards />}
                </div>
              )
            }
          </FinanceSetup>
        )}
      </FinanceStatusGate>
    </PageLoading>
  );
}
