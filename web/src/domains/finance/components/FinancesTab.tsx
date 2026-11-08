import { useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PageLoading, useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { useFinance } from "../hooks/useFinance";
import { BankSources } from "./BankSources";
import { BillsSection } from "./BillsSection";
import { Commitments } from "./Commitments";
import { CredentialsForm } from "./CredentialsForm";
import { DeleteFinanceData } from "./DeleteFinanceData";
import { MonthReport } from "./MonthReport";
import { MonthSpending } from "./MonthSpending";
import { SavedCredentials } from "./SavedCredentials";
import { SetupSteps } from "./SetupSteps";

/** Finances: private to the User, with no link to Residents, Chores, Tasks or Allocation. */
export function FinancesTab() {
  const { t } = useI18n();
  return (
    <PageLoading message={t("finances.loading")}>
      <PageHeader title={t("finances.title")} />
      <FinancesBody />
    </PageLoading>
  );
}

function FinancesBody() {
  const { t } = useI18n();
  const finance = useFinance();
  const { state, busy, problem } = finance;
  const [replacing, setReplacing] = useState(false);
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(finance.refreshing);

  const problemIn = (area: "form" | "connect" | "data") => (problem?.area === area ? problem.problem : null);

  if (state.kind === "loading") {
    return skeleton ? (
      <div aria-hidden="true">
        <SkeletonBar className="h-5 w-full" />
      </div>
    ) : null;
  }
  if (state.kind === "failed") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="my-0 font-semibold">
          {t("finances.load.failed")}
        </p>
        <Button variant="secondary" onClick={() => void finance.reload()}>
          {t("finances.load.retry")}
        </Button>
      </div>
    );
  }

  const status = state.data;
  const showForm = !status.configured || replacing;
  return (
    <div className="flex flex-col gap-4">
      <BillsSection />
      {status.sources.length > 0 && <MonthSpending />}
      {status.sources.length > 0 && <MonthReport />}
      {status.sources.length > 0 && <Commitments />}
      {!status.configured && (
        <>
          <p className="my-0">{t("finances.empty")}</p>
          <SetupSteps />
        </>
      )}
      {showForm ? (
        <CredentialsForm
          saving={busy === "save"}
          problem={problemIn("form")}
          onSave={async (id, secret) => {
            const saved = await finance.save(id, secret);
            if (saved) setReplacing(false);
            return saved;
          }}
          {...(status.configured && { onCancel: () => { setReplacing(false); finance.clearProblem(); } })}
        />
      ) : (
        <SavedCredentials
          removing={busy === "remove"}
          problem={problemIn("data")}
          onReplace={() => setReplacing(true)}
          onRemove={finance.remove}
          onDismissProblem={finance.clearProblem}
        />
      )}
      {status.configured && !replacing && (
        <BankSources
          status={status}
          connecting={busy === "connect"}
          problem={problemIn("connect")}
          closed={finance.closed}
          onConnect={() => void finance.connect()}
        />
      )}
      {(status.configured || status.sources.length > 0) && (
        <DeleteFinanceData
          deleting={busy === "delete"}
          problem={problemIn("data")}
          onDelete={finance.deleteAll}
          onDismissProblem={finance.clearProblem}
        />
      )}
    </div>
  );
}
