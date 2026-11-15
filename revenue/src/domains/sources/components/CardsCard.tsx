import { Card } from "@homeowner/bedrock";
import { Amount, formatAmount } from "@homeowner/bedrock/finance";
import { Link } from "react-router";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { Source } from "../api";
import { BankMark } from "./BankMark";
import { RenameSource } from "./RenameSource";

/** The credit cards, each a link to Faturas with its limit, closing day and open bill; `openBills` maps a card's id to the month's bill, and is empty while that read has not answered. */
export function CardsCard({ sources, openBills }: { sources: Source[]; openBills: Map<string, number> }) {
  const { t, locale } = useI18n();
  const hidden = useHiddenProps();
  const total = sources.reduce((n, s) => n + (openBills.get(s.id) ?? 0), 0);
  return (
    <Card role="group" aria-labelledby="sources-cards">
      <div className="flex items-center justify-between gap-2">
        <h2 id="sources-cards" className="card-label text-text-muted">{t("sources.group.cards")}</h2>
        {openBills.size > 0 && <Amount cents={total} size="md" locale={locale} {...hidden} />}
      </div>
      <ul className="divide-y divide-border">
        {sources.map((source) => {
          const bill = openBills.get(source.id);
          const limit = source.creditLimitCents === undefined ? null : hidden.hidden ? t("sources.card.limit", { amount: hidden.hiddenLabel }) : t("sources.card.limit", { amount: formatAmount(source.creditLimitCents, { locale, precision: "whole" }) });
          const meta = [limit, source.closeDay !== null && t("sources.card.closes", { day: source.closeDay })].filter(Boolean).join(" · ");
          return (
            <li key={source.id} className="flex items-center gap-2">
              <Link
                to="/card-bills"
                className="flex min-h-control-lg min-w-0 flex-1 items-center gap-3 rounded-md py-2 outline-none hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <BankMark name={source.bankName} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="body-strong [overflow-wrap:anywhere]">{source.name}</span>
                  {meta && <span className="caption text-text-muted">{meta}</span>}
                </span>
                {bill !== undefined && (
                  <span className="flex shrink-0 flex-col items-end">
                    <Amount cents={bill} size="sm" locale={locale} {...hidden} />
                    <span className="caption text-text-muted">{t("sources.card.openBill")}</span>
                  </span>
                )}
              </Link>
              <RenameSource source={source} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
