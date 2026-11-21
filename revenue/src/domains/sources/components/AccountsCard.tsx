import { Card } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Source } from "../api";
import { balanceLine } from "../logic/balance";
import { BankMark } from "./BankMark";
import { RenameSource } from "./RenameSource";

/** The checking and savings accounts with their balances and, in the heading, the total of the balances read. */
export function AccountsCard({ sources }: { sources: Source[] }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const lines = sources.map((source) => ({ source, balance: balanceLine(source, locale) }));
  const known = lines.flatMap((l) => (l.balance.kind === "known" ? [l.balance.cents] : []));
  return (
    <Card role="group" aria-labelledby="sources-accounts">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sources-accounts" className="card-label text-text-muted">{t("sources.group.accounts")}</h2>
        {known.length > 0 && <Amount cents={known.reduce((a, b) => a + b, 0)} size="md" locale={locale} {...hidden} />}
      </div>
      <ul className="divide-y divide-border">
        {lines.map(({ source, balance }) => (
          <li key={source.id} className="flex items-center gap-3 py-2">
            <BankMark name={source.bankName} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="body-strong [overflow-wrap:anywhere]">{source.name}</span>
              <span className="caption text-text-muted [overflow-wrap:anywhere]">
                {[
                  t(source.kind === "savings" ? "sources.kind.savings" : "sources.kind.checking"),
                  source.name !== source.bankName && t("sources.bank", { bank: source.bankName }),
                  balance.kind === "known" && t("sources.balance.updated", { day: balance.day }),
                ].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              {balance.kind === "known" ? (
                <>
                  <Amount cents={balance.cents} size="sm" locale={locale} {...hidden} />
                  <span className="caption text-text-muted">{t("sources.balance.available")}</span>
                </>
              ) : (
                <span className="caption text-text-muted">{t("sources.balance.none")}</span>
              )}
            </div>
            <RenameSource source={source} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
