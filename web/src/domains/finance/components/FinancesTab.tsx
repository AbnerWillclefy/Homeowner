import { Settings } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { FINANCES_SETTINGS_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { useFinance } from "../hooks/useFinance";
import { BillsSection } from "./BillsSection";
import { ChartPreview } from "./charts/ChartPreview";
import { Commitments } from "./Commitments";
import { FinanceSetup, FinanceStatusGate } from "./FinanceSetup";
import { FinanceTabs, VIEWS, type FinanceView } from "./FinanceTabs";
import { Spending } from "./Spending";

/** Finances: private to the User, with no link to Residents, Chores, Tasks or Allocation. */
export function FinancesTab() {
  const { t } = useI18n();
  const finance = useFinance();
  // Ajustes only once there are Sources: before that the setup flow is the whole page.
  const hasSources = finance.state.kind === "ready" && finance.state.data.sources.length > 0;
  return (
    <PageLoading message={t("finances.loading")}>
      <PageHeader
        title={t("finances.title")}
        aside={
          hasSources && (
            <Button asChild variant="secondary">
              <Link to={FINANCES_SETTINGS_PATH}>
                <Settings aria-hidden="true" size={18} />
                {t("finances.settings.open")}
              </Link>
            </Button>
          )
        }
      />
      {import.meta.env.DEV && <ChartPreview />}
      <FinancesBody finance={finance} />
    </PageLoading>
  );
}

/** The view kept in this history entry's state, so Back from Ajustes returns to it. Never in the URL. */
function useView(): [FinanceView, (view: FinanceView) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const kept = (location.state as { view?: unknown } | null)?.view;
  const view = VIEWS.find((v) => v === kept) ?? "summary";
  // Same path, so the shell's focus-on-navigate (keyed on the pathname) does not fire.
  return [view, (next) => navigate(".", { replace: true, state: { view: next } })];
}

function FinancesBody({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const { t } = useI18n();
  const [view, setView] = useView();

  return (
    <FinanceStatusGate finance={finance}>
      {(status) => (
        <FinanceSetup finance={finance} status={status}>
          {({ sources, credentials, deletion }) =>
            // Before the first Source there is nothing to read yet: the setup flow stays one short column.
            status.sources.length === 0 ? (
              <div className="flex flex-col gap-4">
                <BillsSection />
                {credentials}
                {sources}
                {deletion}
              </div>
            ) : (
              <FinanceTabs
                view={view}
                onView={setView}
                panels={{
                  summary: (
                    <Button asChild variant="link">
                      <Link to={FINANCES_SETTINGS_PATH}>{t("finances.summary.income")}</Link>
                    </Button>
                  ),
                  spending: (
                    <>
                      {status.importing && <p className="my-0 text-muted">{t("finances.importing")}</p>}
                      <Spending />
                    </>
                  ),
                  bills: (
                    <>
                      <BillsSection />
                      <Commitments />
                    </>
                  ),
                }}
              />
            )
          }
        </FinanceSetup>
      )}
    </FinanceStatusGate>
  );
}
