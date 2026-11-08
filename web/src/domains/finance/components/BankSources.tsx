import { Landmark } from "lucide-react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { SectionCard } from "../../../shared/ui/SectionCard";
import type { FinanceStatus } from "../api/api";
import type { ConnectProblem } from "../logic/connectFlow";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";
import { formatSyncTime } from "../logic/syncTime";

const KIND_KEY: Record<string, MessageKey> = {
  checking: "finances.kind.checking",
  savings: "finances.kind.savings",
  credit_card: "finances.kind.credit_card",
};

interface Props {
  status: FinanceStatus;
  connecting: boolean;
  problem: ConnectProblem | null;
  /** The widget closed with nothing connected. */
  closed: boolean;
  onConnect(): void;
}

/** Connect banks, the Sources, and whether they are importing or when they last synced. */
export function BankSources({ status, connecting, problem, closed, onConnect }: Props) {
  const { t, locale } = useI18n();
  return (
    <SectionCard id="finances-sources-heading" icon={Landmark} title={t("finances.sources.heading")}>
      <Button fullWidth pending={connecting} onClick={onConnect}>
        {t("finances.connect")}
      </Button>
      <FormError form="finances-connect">{problem && t(FINANCE_FAILURE_KEY[problem])}</FormError>
      {closed && (
        <p role="status" className="my-0 text-muted">
          {t("finances.connect.closed")}
        </p>
      )}
      {status.sources.length === 0 ? (
        <p className="my-0 text-muted">{t("finances.sources.none")}</p>
      ) : (
        <ul className="my-0 flex list-none flex-col gap-2 p-0">
          {status.sources.map((source) => (
            <li key={source.id} className="flex flex-col">
              <span className="font-semibold [overflow-wrap:anywhere]">{source.name}</span>
              <span className="text-sm text-muted">{KIND_KEY[source.kind] ? t(KIND_KEY[source.kind]!) : source.kind}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Always in the page, so a screen reader hears it appear. No countdown, no alarm colour. */}
      <p role="status" className="my-0 text-sm text-muted">
        {status.importing
          ? t("finances.importing")
          : status.lastSyncedAt && t("finances.lastSync", { when: formatSyncTime(status.lastSyncedAt, locale) })}
      </p>
    </SectionCard>
  );
}
