import { Button, Card } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { CreditCard, Landmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { MessageKey } from "../../../shared/i18n/catalogs";
import type { Source } from "../api";
import { balanceLine } from "../logic/balance";
import { SourceNameForm } from "./SourceNameForm";

const KIND_KEY: Record<string, MessageKey> = {
  checking: "sources.kind.checking",
  savings: "sources.kind.savings",
  credit_card: "sources.kind.credit_card",
};

/** One Source: its names, kind, balance and the day it was read, and the form to rename it. */
export function SourceItem({ source }: { source: Source }) {
  const { t, locale } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(false);
  // The form held focus when it closed; give it back to the button that opened it.
  useEffect(() => {
    if (wasRenaming.current && !renaming) renameButton.current?.focus();
    wasRenaming.current = renaming;
  }, [renaming]);

  const Icon = source.kind === "credit_card" ? CreditCard : Landmark;
  const kind = KIND_KEY[source.kind];
  const balance = balanceLine(source, locale);
  return (
    <Card className="gap-3">
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-1 size-5 shrink-0 text-text-muted" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="body-strong [overflow-wrap:anywhere]">{source.name}</h3>
          {source.name !== source.bankName && <p className="caption text-text-muted [overflow-wrap:anywhere]">{t("sources.bank", { bank: source.bankName })}</p>}
          <p className="caption text-text-muted">{kind ? t(kind) : source.kind}</p>
          {source.kind === "credit_card" && (
            <p className="caption text-text-muted">
              {source.closeDay !== null && source.dueDay !== null ? t("sources.billDays.set", { close: source.closeDay, due: source.dueDay }) : t("sources.billDays.unset")}
            </p>
          )}
          {balance.kind === "known" && (
            <p className="flex flex-wrap items-baseline gap-x-2">
              <Amount cents={balance.cents} size="md" locale={locale} />
              <span className="caption text-text-muted">{t("sources.balance.updated", { day: balance.day })}</span>
            </p>
          )}
          {balance.kind === "unknown" && <p className="caption text-text-muted">{t("sources.balance.none")}</p>}
        </div>
      </div>
      {renaming ? (
        <SourceNameForm source={source} onDone={() => setRenaming(false)} />
      ) : (
        <div>
          <Button ref={renameButton} variant="secondary" aria-label={t("sources.name.editFor", { name: source.name })} onClick={() => setRenaming(true)}>
            {t("sources.name.edit")}
          </Button>
        </div>
      )}
    </Card>
  );
}
