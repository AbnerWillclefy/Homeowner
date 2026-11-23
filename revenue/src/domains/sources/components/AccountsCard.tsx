import { Card } from "@homeowner/bedrock";
import { Amount } from "@homeowner/bedrock/finance";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Source } from "../api";
import { balanceLine } from "../logic/balance";
import { BankMark } from "./BankMark";
import { RenameSource } from "./RenameSource";
import { SourceRow } from "./SourceRow";

/** The checking and savings accounts with their balances and, in the heading, the total of the balances read. A row opens the rename form. */
export function AccountsCard({ sources }: { sources: Source[] }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const lines = sources.map((source) => ({ source, balance: balanceLine(source, locale) }));
  const known = lines.flatMap((l) => (l.balance.kind === "known" ? [l.balance.cents] : []));
  return (
    <Card role="group" aria-labelledby="sources-accounts">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sources-accounts" className="card-label text-text-muted">{t("sources.group.accounts")}</h2>
        {known.length > 0 && <Amount cents={known.reduce((a, b) => a + b, 0)} size="sm" locale={locale} {...hidden} />}
      </div>
      <ul className="divide-y divide-border">
        {lines.map(({ source, balance }) => (
          <li key={source.id}>
            <RenameSource
              source={source}
              trigger={
                <SourceRow
                  leading={<BankMark name={source.bankName} />}
                  title={source.name}
                  subtitle={[
                    t(source.kind === "savings" ? "sources.kind.savings" : "sources.kind.checking"),
                    source.name !== source.bankName && t("sources.bank", { bank: source.bankName }),
                    balance.kind === "known" && t("sources.balance.updated", { day: balance.day }),
                  ].filter(Boolean).join(" · ")}
                  cents={balance.kind === "known" ? balance.cents : undefined}
                  end={balance.kind === "known" ? t("sources.balance.available") : <span className="caption text-text-muted">{t("sources.balance.none")}</span>}
                >
                  <button type="button" aria-label={t("sources.name.editFor", { name: source.name })} />
                </SourceRow>
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
