import { useEffect, useRef, useState } from "react";
import { CreditCard, Landmark } from "lucide-react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { FormError } from "../../../shared/ui/FormError";
import { CardBillDaysForm } from "./CardBillDaysForm";
import { FinanceCard } from "./FinanceCard";
import { SourceNameForm } from "./SourceNameForm";
import type { FinanceStatus } from "../api/api";
import type { ConnectProblem } from "../logic/connectFlow";
import { FINANCE_FAILURE_KEY } from "../logic/failureMessages";
import { formatSyncTime } from "../logic/syncTime";

const KIND_KEY: Record<string, MessageKey> = {
  checking: "finances.kind.checking",
  savings: "finances.kind.savings",
  credit_card: "finances.kind.credit_card",
};

type Form = "days" | "name";
const FORM_BUTTON: Record<Form, string> = { days: "finances-bill-days-edit", name: "finances-source-name-edit" };

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
  // One form open at a time: opening the other kind, or another Source's, closes this one.
  const [editing, setEditing] = useState<{ id: string; form: Form } | null>(null);
  const returnFocus = useRef<string | null>(null);
  // The form held focus when it closed; give it back to the button that opened it.
  useEffect(() => {
    if (editing !== null || returnFocus.current === null) return;
    document.getElementById(returnFocus.current)?.focus();
    returnFocus.current = null;
  }, [editing]);
  const closeForm = (id: string, form: Form) => {
    returnFocus.current = `${FORM_BUTTON[form]}-${id}`;
    setEditing(null);
  };
  return (
    <FinanceCard id="finances-sources-heading" title={t("finances.sources.heading")}>
      {status.sources.length === 0 ? (
        <p className="my-0 text-muted">{t("finances.sources.none")}</p>
      ) : (
        <ul className="my-0 flex list-none flex-col p-0">
          {status.sources.map((source) => {
            const open = editing?.id === source.id ? editing : null;
            const Icon = source.kind === "credit_card" ? CreditCard : Landmark;
            return (
              <li key={source.id} className="flex flex-col border-t border-chart-track py-2.5 first:border-t-0">
                <div className="flex items-start gap-3">
                  <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-control bg-chart-track text-muted">
                    <Icon size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold [overflow-wrap:anywhere]">{source.name}</span>
                    {source.name !== source.bankName && (
                      <span className="text-sm text-muted [overflow-wrap:anywhere]">{t("finances.sourceName.bank", { bank: source.bankName })}</span>
                    )}
                    <span className="text-sm text-muted">{KIND_KEY[source.kind] ? t(KIND_KEY[source.kind]!) : source.kind}</span>
                    {source.kind === "credit_card" && (
                      <span className="text-sm text-muted [overflow-wrap:anywhere]">
                        {source.closeDay !== null && source.dueDay !== null
                          ? t("finances.billDays.set", { close: source.closeDay, due: source.dueDay })
                          : t("finances.billDays.unset")}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-2">
                      {open?.form !== "name" && (
                        <Button
                          id={`${FORM_BUTTON.name}-${source.id}`}
                          variant="secondary"
                          aria-label={t("finances.sourceName.editFor", { name: source.name })}
                          onClick={() => setEditing({ id: source.id, form: "name" })}
                        >
                          {t("finances.sourceName.edit")}
                        </Button>
                      )}
                      {source.kind === "credit_card" && open?.form !== "days" && (
                        <Button
                          id={`${FORM_BUTTON.days}-${source.id}`}
                          variant="secondary"
                          aria-label={t("finances.billDays.editFor", { name: source.name })}
                          onClick={() => setEditing({ id: source.id, form: "days" })}
                        >
                          {t("finances.billDays.edit")}
                        </Button>
                      )}
                    </span>
                  </span>
                </div>
                {open?.form === "name" && <SourceNameForm source={source} onDone={() => closeForm(source.id, "name")} />}
                {source.kind === "credit_card" && open?.form === "days" && (
                  <CardBillDaysForm source={source} onDone={() => closeForm(source.id, "days")} />
                )}
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
