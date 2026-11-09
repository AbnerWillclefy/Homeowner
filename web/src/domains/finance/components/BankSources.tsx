import { CreditCard, Landmark } from "lucide-react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { FinanceCard } from "./FinanceCard";
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
    <FinanceCard id="finances-sources-heading" title={t("finances.sources.heading")}>
      {status.sources.length === 0 ? (
        <p className="my-0 text-muted">{t("finances.sources.none")}</p>
      ) : (
        <ul className="my-0 flex list-none flex-col p-0">
          {status.sources.map((source) => {
            const Icon = source.kind === "credit_card" ? CreditCard : Landmark;
            return (
              <li key={source.id} className="flex items-center gap-3 border-t border-chart-track py-2.5 first:border-t-0">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-chart-track text-muted">
                  <Icon size={20} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold [overflow-wrap:anywhere]">{source.name}</span>
                  <span className="text-sm text-muted">{KIND_KEY[source.kind] ? t(KIND_KEY[source.kind]!) : source.kind}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {/* Always in the page, so a screen reader hears it appear. No countdown, no alarm colour. */}
      <p role="status" className="my-0 text-sm text-muted">
        {status.importing
          ? t("finances.importing")
          : status.lastSyncedAt && t("finances.lastSync", { when: formatSyncTime(status.lastSyncedAt, locale) })}
      </p>
      {/* Before the first Source it is the page's one action, so it is filled; after, it is one action among many. */}
      <Button fullWidth variant={status.sources.length === 0 ? "primary" : "secondary"} pending={connecting} onClick={onConnect}>
        {t("finances.connect")}
      </Button>
      <FormError form="finances-connect">{problem && t(FINANCE_FAILURE_KEY[problem])}</FormError>
      {closed && (
        <p role="status" className="my-0 text-muted">
          {t("finances.connect.closed")}
        </p>
      )}
    </FinanceCard>
  );
}
