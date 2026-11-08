import { useLocation, useNavigate } from "react-router";
import { useI18n } from "../../../shared/i18n";
import { FINANCES_PATH } from "../../../app/logic/routes";
import { Button } from "../../../shared/ui/Button";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PageLoading } from "../../../shared/ui/PageLoading";
import { useFinance } from "../hooks/useFinance";
import { MonthlyIncome } from "./Commitments";
import { FinanceSetup, FinanceStatusGate } from "./FinanceSetup";

/** Ajustes, at /finances/ajustes: Sources, Monthly income, credentials and deleting the data. */
export function FinanceSettings() {
  const { t } = useI18n();
  const finance = useFinance();
  const navigate = useNavigate();
  // "default" is the first entry of the session (a reload or a deep link): there is no earlier view to return to.
  const canGoBack = useLocation().key !== "default";
  return (
    <PageLoading message={t("finances.loading")}>
      <PageHeader title={t("finances.settings.title")} />
      <div className="flex flex-col gap-8">
        <div>
          <Button variant="secondary" onClick={() => (canGoBack ? navigate(-1) : navigate(FINANCES_PATH))}>
            {t("finances.settings.back")}
          </Button>
        </div>
        <FinanceStatusGate finance={finance}>
          {(status) => (
            <FinanceSetup finance={finance} status={status}>
              {({ sources, credentials, deletion }) => (
                <>
                  {sources}
                  <MonthlyIncome />
                  {credentials}
                  {deletion}
                </>
              )}
            </FinanceSetup>
          )}
        </FinanceStatusGate>
      </div>
    </PageLoading>
  );
}
