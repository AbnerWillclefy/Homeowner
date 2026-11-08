import { useState, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import type { FinanceStatus } from "../api/api";
import type { useFinance } from "../hooks/useFinance";
import { BankSources } from "./BankSources";
import { CredentialsForm } from "./CredentialsForm";
import { DeleteFinanceData } from "./DeleteFinanceData";
import { SavedCredentials } from "./SavedCredentials";
import { SetupSteps } from "./SetupSteps";

export type Finance = ReturnType<typeof useFinance>;

/** The loading skeleton and the retry line, then `children` once the status is read. Shared by the tab and Ajustes. */
export function FinanceStatusGate({ finance, children }: { finance: Finance; children: (status: FinanceStatus) => ReactNode }) {
  const { t } = useI18n();
  const { state } = finance;
  const skeleton = useReportFirstLoad(state.kind === "loading");
  useReportFetching(finance.refreshing);

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
  return children(state.data);
}

/** The credentials, bank Sources and delete pieces, for the caller to place. They hold the "replacing" state. */
export function FinanceSetup({
  finance,
  status,
  children,
}: {
  finance: Finance;
  status: FinanceStatus;
  children: (parts: { sources: ReactNode; credentials: ReactNode; deletion: ReactNode }) => ReactNode;
}) {
  const { t } = useI18n();
  const { busy, problem } = finance;
  const [replacing, setReplacing] = useState(false);
  const problemIn = (area: "form" | "connect" | "data") => (problem?.area === area ? problem.problem : null);

  const showForm = !status.configured || replacing;
  const credentials = (
    <>
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
    </>
  );
  const deletion = (status.configured || status.sources.length > 0) && (
    <DeleteFinanceData
      deleting={busy === "delete"}
      problem={problemIn("data")}
      onDelete={finance.deleteAll}
      onDismissProblem={finance.clearProblem}
    />
  );
  const sources = status.configured && !replacing && (
    <BankSources
      status={status}
      connecting={busy === "connect"}
      problem={problemIn("connect")}
      closed={finance.closed}
      onConnect={() => void finance.connect()}
    />
  );
  return <>{children({ sources, credentials, deletion })}</>;
}
