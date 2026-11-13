import { Amount } from "@homeowner/bedrock/finance";
import { CreditCard } from "lucide-react";
import { useId } from "react";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CardBill } from "../api";

/** The month's credit card bills, listed and nothing more: they come from the card's own transactions, so there is no action to take here. */
export function CardBills({ cards }: { cards: CardBill[] }) {
  const { t, locale } = useI18n();
  const id = useId();
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="section-title">{t("bills.cards.heading")}</h2>
      <p className="caption text-text-muted">{t("bills.cards.hint")}</p>
      <ul className="divide-y divide-border">
        {cards.map((card) => (
          <li key={card.sourceId} className="flex items-center gap-4 py-3">
            <CreditCard className="size-5 shrink-0 text-text-muted" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="body-strong [overflow-wrap:anywhere]">{card.name}</span>
              {!card.billDaysKnown && <span className="caption text-text-muted">{t("bills.cards.noDays")}</span>}
            </div>
            <Amount cents={card.amountCents} size="sm" locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
